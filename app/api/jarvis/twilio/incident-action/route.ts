import { createCodexDraftFromIncident, twilioWebhookUrl, twiml, verifyTwilioSignature } from "@/lib/jarvis-phone";

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
    if (result.created) return twiml("<Say voice=\"Polly.Matthew\">The Codex repair draft is ready. Review and approve it in the Jarvis admin dashboard. Nothing has been deployed.</Say>");
    if (result.reason === "already_exists") return twiml("<Say voice=\"Polly.Matthew\">A repair draft already exists for this incident. Review it in the Jarvis admin dashboard.</Say>");
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be authorized. No task was created.</Say>");
  } catch {
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be created right now. No task was started.</Say>");
  }
}
