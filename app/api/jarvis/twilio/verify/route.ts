import { authorizeJarvisPhoneCall, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";
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
  const action = xmlEscape(twilioWebhookUrl("/api/jarvis/twilio/menu"));
  return twiml(`<Say voice="Polly.Matthew">Code accepted, Sir.</Say><Gather action="${action}" method="POST" input="speech dtmf" numDigits="1" timeout="8" speechTimeout="auto" hints="report a bug,talk to Jarvis,operations question"><Say voice="Polly.Matthew">How can I help you, Sir?</Say></Gather><Say voice="Polly.Matthew">I did not hear a request. Please call again when you are ready, Sir.</Say>`);
}
