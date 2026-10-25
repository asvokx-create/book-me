import { twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  const alertId = new URL(request.url).searchParams.get("alertId") ?? "";
  const signatureUrl = twilioWebhookUrl(`/api/jarvis/twilio/incident-response?alertId=${encodeURIComponent(alertId)}`);
  if (!verifyTwilioSignature(signatureUrl, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) return twiml("<Say voice=\"Polly.Matthew\">That incident could not be identified. Goodbye.</Say><Hangup/>");

  const digits = params.get("Digits") ?? "";
  const speech = (params.get("SpeechResult") ?? "").toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const notNow = digits === "2" || /\b(no|nope|later|busy)\b|not now|bad time/.test(speech);
  const ready = digits === "1" || /\b(yes|yeah|yep|sure|okay|ok)\b|go ahead|good time/.test(speech);

  if (notNow) {
    return twiml("<Say voice=\"Polly.Matthew\">No problem. The incident is available in your Jarvis admin dashboard when you are ready. Goodbye.</Say><Hangup/>");
  }

  if (ready) {
    const action = xmlEscape(twilioWebhookUrl(`/api/jarvis/twilio/incident-action?alertId=${encodeURIComponent(alertId)}`));
    return twiml(`<Gather action="${action}" method="POST" input="speech dtmf" numDigits="1" timeout="8" speechTimeout="auto" hints="tell Codex to fix it,send it to Codex"><Say voice="Polly.Matthew">Would you like me to create a Codex repair draft for your review? Say tell Codex to fix it, or press 1. Otherwise, say no.</Say></Gather><Say voice="Polly.Matthew">No repair draft was created. The incident remains available in your admin dashboard.</Say>`);
  }

  const retry = xmlEscape(signatureUrl);
  return twiml(`<Gather action="${retry}" method="POST" input="speech dtmf" numDigits="1" timeout="6" speechTimeout="auto" hints="yes,no,not now"><Say voice="Polly.Matthew">Sorry, I did not catch that. Is now a good time? Say yes or press 1. Say no or press 2.</Say></Gather><Say voice="Polly.Matthew">I will leave the incident in your admin dashboard. Goodbye.</Say><Hangup/>`);
}
