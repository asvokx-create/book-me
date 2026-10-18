import { acceptOpenAIPhoneCall, claimAuthorizedSipSession, claimVoiceWebhook, rejectOpenAIPhoneCall, verifyOpenAIWebhook, webhookDeliveryFallback } from "@/lib/jarvis-phone";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1_048_576) return new Response("Request too large.", { status: 413 });
  let event;
  try {
    event = await verifyOpenAIWebhook(rawBody, request.headers);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }
  const deliveryId = request.headers.get("webhook-id") ?? event.id ?? webhookDeliveryFallback(rawBody);
  if (!await claimVoiceWebhook("openai", deliveryId, event.type)) return Response.json({ ok: true, duplicate: true });
  if (event.type !== "realtime.call.incoming" && event.type !== "live.transport.incoming" && event.type !== "live.call.incoming") {
    return Response.json({ ok: true, ignored: true });
  }
  const callId = event.data?.call_id ?? event.data?.session_id ?? "";
  if (!callId) return new Response("Missing call identifier.", { status: 400 });
  if (!await claimAuthorizedSipSession(event.data?.sip_headers)) {
    await rejectOpenAIPhoneCall(callId, event.type);
    return Response.json({ ok: true, accepted: false });
  }
  try {
    await acceptOpenAIPhoneCall(callId, event.type);
    return Response.json({ ok: true, accepted: true });
  } catch {
    await rejectOpenAIPhoneCall(callId, event.type);
    return new Response("Call acceptance failed.", { status: 502 });
  }
}
