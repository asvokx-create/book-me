import { claimVoiceWebhook, recordTwilioCallStatus, twilioWebhookUrl, verifyTwilioSignature } from "@/lib/jarvis-phone";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  if (!verifyTwilioSignature(twilioWebhookUrl("/api/jarvis/twilio/status"), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const callSid = params.get("CallSid") ?? "";
  const status = params.get("CallStatus") ?? "unknown";
  if (!callSid || !await claimVoiceWebhook("twilio", `${callSid}:${status}`, `call.${status}`)) return new Response(null, { status: 204 });
  await recordTwilioCallStatus(callSid, status);
  return new Response(null, { status: 204 });
}
