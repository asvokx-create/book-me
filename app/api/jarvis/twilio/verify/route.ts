import { authorizeJarvisPhoneCall, jarvisPhoneConfiguration, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  if (!verifyTwilioSignature(twilioWebhookUrl("/api/jarvis/twilio/verify"), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const callSid = params.get("CallSid") ?? "";
  if (!await enforceRateLimit({ request, userId: `twilio:${callSid}`, bucket: "jarvis-phone-pin", limit: 5, windowSeconds: 600 })) {
    return twiml("<Say voice=\"Polly.Matthew\">Too many attempts. Generate a new code later.</Say><Hangup/>");
  }
  const token = await authorizeJarvisPhoneCall(callSid, params.get("From") ?? "", params.get("Digits") ?? "");
  if (!token) return twiml("<Say voice=\"Polly.Matthew\">That code is invalid or expired. Generate a new code and call again.</Say><Hangup/>");
  const projectId = jarvisPhoneConfiguration().openAiProjectId;
  const sipUri = `sip:${projectId}@sip.api.openai.com;transport=tls?x-jarvis-session=${encodeURIComponent(token)}`;
  return twiml(`<Say voice="Polly.Matthew">Code accepted. Connecting you to Jarvis.</Say><Dial timeout="20"><Sip>${xmlEscape(sipUri)}</Sip></Dial>`);
}
