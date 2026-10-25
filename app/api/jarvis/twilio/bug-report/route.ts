import { createCodexDraftFromPhoneReport, twilioWebhookUrl, twiml, verifyTwilioSignature } from "@/lib/jarvis-phone";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  if (!verifyTwilioSignature(twilioWebhookUrl("/api/jarvis/twilio/bug-report"), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const callSid = params.get("CallSid") ?? "";
  if (!await enforceRateLimit({ request, userId: `twilio:${callSid}`, bucket: "jarvis-phone-bug-report", limit: 3, windowSeconds: 600 })) {
    return twiml("<Say voice=\"Polly.Matthew\">Too many attempts. No task was created.</Say><Hangup/>");
  }
  try {
    const result = await createCodexDraftFromPhoneReport(callSid, params.get("SpeechResult") ?? "");
    if (result.created) return twiml("<Say voice=\"Polly.Matthew\">Your bug report is saved as a Codex repair draft. Review and approve it in the Jarvis admin dashboard. Nothing has been pushed or deployed.</Say>");
    if (result.reason === "already_exists") return twiml("<Say voice=\"Polly.Matthew\">A repair draft from this call already exists. Review it in the Jarvis admin dashboard.</Say>");
    if (result.reason === "sensitive_data") return twiml("<Say voice=\"Polly.Matthew\">I could not save that report because it may contain private information. Remove the private details and create the draft in the Jarvis admin dashboard.</Say>");
    if (result.reason === "too_short") return twiml("<Say voice=\"Polly.Matthew\">That description was too short. No task was created.</Say>");
    return twiml("<Say voice=\"Polly.Matthew\">Your secure phone session expired. No task was created.</Say>");
  } catch {
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be created right now. Nothing was started.</Say>");
  }
}
