import { approvePhoneCodexTask, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  const taskId = new URL(request.url).searchParams.get("taskId") ?? "";
  const pathname = `/api/jarvis/twilio/codex-approval?taskId=${encodeURIComponent(taskId)}`;
  if (!verifyTwilioSignature(twilioWebhookUrl(pathname), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const callSid = params.get("CallSid") ?? "";
  if (!await enforceRateLimit({ request, userId: `twilio:${callSid}`, bucket: "jarvis-phone-codex-approval", limit: 4, windowSeconds: 600 })) {
    return twiml("<Say voice=\"Polly.Matthew\">Too many attempts. The draft was not sent.</Say><Hangup/>");
  }
  const digits = params.get("Digits") ?? "";
  const speech = (params.get("SpeechResult") ?? "").toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  const denied = digits === "2" || /\b(no|nope|cancel|stop|later)\b|not now|do not|don't/.test(speech);
  const approved = digits === "1" || /\b(yes|yeah|yep|approve|send)\b|go ahead/.test(speech);
  if (denied) return twiml("<Say voice=\"Polly.Matthew\">Understood, Sir. The draft was not sent. You can review it later in the Jarvis admin dashboard.</Say><Hangup/>");
  if (!approved) {
    const retry = xmlEscape(twilioWebhookUrl(pathname));
    return twiml(`<Gather action="${retry}" method="POST" input="speech dtmf" numDigits="1" timeout="6" speechTimeout="auto" hints="yes,approve it,send it,no,cancel"><Say voice="Polly.Matthew">I need a clear approval before I send this task. Say yes or press 1 to approve. Say no or press 2 to keep it as a draft.</Say></Gather><Say voice="Polly.Matthew">No approval was received. The draft was not sent.</Say>`);
  }
  try {
    const result = await approvePhoneCodexTask(taskId, callSid);
    if (result.dispatched && result.alreadyDispatched) return twiml("<Say voice=\"Polly.Matthew\">That task was already sent to Codex. Nothing was sent twice.</Say><Hangup/>");
    if (result.dispatched) return twiml("<Say voice=\"Polly.Matthew\">Approved, Sir. The task was sent to Codex for investigation and testing. Codex cannot deploy or push it automatically.</Say><Hangup/>");
    return twiml("<Say voice=\"Polly.Matthew\">I could not authorize that draft from this call, so nothing was sent.</Say><Hangup/>");
  } catch {
    return twiml("<Say voice=\"Polly.Matthew\">Codex could not start the task right now. Nothing was deployed or pushed. The draft remains visible in the admin dashboard.</Say><Hangup/>");
  }
}
