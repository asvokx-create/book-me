import { createCodexDraftFromIncident, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  const alertId = new URL(request.url).searchParams.get("alertId") ?? "";
  const signatureUrl = twilioWebhookUrl(`/api/jarvis/twilio/incident-action?alertId=${encodeURIComponent(alertId)}`);
  if (!verifyTwilioSignature(signatureUrl, params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) return twiml("<Say voice=\"Polly.Matthew\">That incident could not be identified. No task was created.</Say>");
  const digits = params.get("Digits") ?? "";
  const speech = (params.get("SpeechResult") ?? "").toLowerCase().slice(0, 300);
  const confirmed = digits === "1" || (speech.includes("codex") && /\b(fix|send|tell|investigate|repair)\b/.test(speech));
  if (!confirmed) return twiml("<Say voice=\"Polly.Matthew\">No repair draft was created. Goodbye.</Say>");
  try {
    const result = await createCodexDraftFromIncident(alertId, params.get("CallSid") ?? "");
    if ((result.created || result.reason === "already_exists") && result.taskId) {
      const action = xmlEscape(twilioWebhookUrl(`/api/jarvis/twilio/codex-approval?taskId=${encodeURIComponent(result.taskId)}`));
      return twiml(`<Gather action="${action}" method="POST" input="speech dtmf" numDigits="1" timeout="8" speechTimeout="auto" hints="yes,approve it,send it to Codex,no,cancel"><Say voice="Polly.Matthew">${result.created ? "The Codex repair draft is ready." : "A repair draft already exists for this incident."} Would you like me to approve it and send it to Codex now? Say yes or press 1. Say no or press 2.</Say></Gather><Say voice="Polly.Matthew">I did not hear an approval, so the draft was not sent. You can review it in the Jarvis admin dashboard.</Say>`);
    }
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be authorized. No task was created.</Say>");
  } catch {
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be created right now. No task was started.</Say>");
  }
}
