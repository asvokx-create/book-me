import { jarvisPhoneConfiguration, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  if (!verifyTwilioSignature(twilioWebhookUrl("/api/jarvis/twilio/voice"), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const config = jarvisPhoneConfiguration();
  if (!config.inboundConfigured || params.get("To") !== config.twilioPhone) return twiml("<Reject reason=\"rejected\"/>");
  const action = xmlEscape(twilioWebhookUrl("/api/jarvis/twilio/verify"));
  return twiml(`<Gather action="${action}" method="POST" input="dtmf" numDigits="6" timeout="8"><Say voice="Polly.Matthew">Welcome to Jarvis. Enter the six digit access code shown in your signed in BubsBookings admin dashboard.</Say></Gather><Say voice="Polly.Matthew">No code was received. Goodbye.</Say>`);
}
