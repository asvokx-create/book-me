import { createCodexDraftFromPhoneReport, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";
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
    if ((result.created || result.reason === "already_exists") && result.taskId) {
      const action = xmlEscape(twilioWebhookUrl(`/api/jarvis/twilio/codex-approval?taskId=${encodeURIComponent(result.taskId)}`));
      return twiml(`<Gather action="${action}" method="POST" input="speech dtmf" numDigits="1" timeout="8" speechTimeout="auto" hints="yes,approve it,send it to Codex,no,cancel"><Say voice="Polly.Matthew">${result.created ? "I created a Codex repair draft from your report." : "A repair draft from this call already exists."} Would you like me to approve it and send it to Codex now? Say yes or press 1. Say no or press 2.</Say></Gather><Say voice="Polly.Matthew">I did not hear an approval, so the draft was not sent. You can review it in the Jarvis admin dashboard.</Say>`);
    }
    if (result.reason === "sensitive_data") return twiml("<Say voice=\"Polly.Matthew\">I could not save that report because it may contain private information. Remove the private details and create the draft in the Jarvis admin dashboard.</Say>");
    if (result.reason === "too_short") return twiml("<Say voice=\"Polly.Matthew\">That description was too short. No task was created.</Say>");
    return twiml("<Say voice=\"Polly.Matthew\">Your secure phone session expired. No task was created.</Say>");
  } catch {
    return twiml("<Say voice=\"Polly.Matthew\">The repair draft could not be created right now. Nothing was started.</Say>");
  }
}
