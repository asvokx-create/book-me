import { issueJarvisSipSessionToken, jarvisPhoneConfiguration, twilioWebhookUrl, twiml, verifyTwilioSignature, xmlEscape } from "@/lib/jarvis-phone";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 32_768) return new Response("Request too large.", { status: 413 });
  const params = new URLSearchParams(body);
  if (!verifyTwilioSignature(twilioWebhookUrl("/api/jarvis/twilio/menu"), params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature.", { status: 403 });
  }
  const callSid = params.get("CallSid") ?? "";
  if (!await enforceRateLimit({ request, userId: `twilio:${callSid}`, bucket: "jarvis-phone-menu", limit: 5, windowSeconds: 600 })) {
    return twiml("<Say voice=\"Polly.Matthew\">Too many attempts. Please try again later.</Say><Hangup/>");
  }
  const digits = params.get("Digits") ?? "";
  const speech = (params.get("SpeechResult") ?? "").toLowerCase().slice(0, 200);
  const reportingBug = digits === "1" || /\b(bug|problem|issue|broken|report)\b/.test(speech);
  if (reportingBug) {
    const action = xmlEscape(twilioWebhookUrl("/api/jarvis/twilio/bug-report"));
    return twiml(`<Gather action="${action}" method="POST" input="speech" timeout="8" speechTimeout="auto"><Say voice="Polly.Matthew">Describe the bug, where you saw it, and what should happen instead. Do not include customer names, email addresses, phone numbers, payment details, or other private information.</Say></Gather><Say voice="Polly.Matthew">No bug description was received. No task was created.</Say>`);
  }
  const token = await issueJarvisSipSessionToken(callSid);
  if (!token) return twiml("<Say voice=\"Polly.Matthew\">Your secure phone session expired. Generate a new code and call again.</Say><Hangup/>");
  const projectId = jarvisPhoneConfiguration().openAiProjectId;
  const sipUri = `sip:${projectId}@sip.api.openai.com;transport=tls?x-jarvis-session=${encodeURIComponent(token)}`;
  return twiml(`<Say voice="Polly.Matthew">Connecting you to Jarvis.</Say><Dial timeout="20"><Sip>${xmlEscape(sipUri)}</Sip></Dial>`);
}
