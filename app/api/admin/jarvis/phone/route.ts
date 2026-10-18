import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getJarvisPhoneSettings, issueJarvisPhoneCode, jarvisPhoneConfiguration, maskPhone, updateJarvisPhoneSettings } from "@/lib/jarvis-phone";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const config = jarvisPhoneConfiguration();
  return NextResponse.json({
    inboundConfigured: config.inboundConfigured,
    outboundConfigured: config.outboundConfigured,
    alertPhone: maskPhone(config.alertPhone),
    maxOutboundCallsPerDay: config.maxOutboundCallsPerDay,
    settings: await getJarvisPhoneSettings(),
  });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-jarvis-phone-code", limit: 3, windowSeconds: 600 })) {
    return NextResponse.json({ error: "Too many phone-code requests. Please wait before creating another code." }, { status: 429 });
  }
  if (!jarvisPhoneConfiguration().inboundConfigured) return NextResponse.json({ error: "Jarvis phone access is not configured yet." }, { status: 503 });
  const result = await issueJarvisPhoneCode(session.user.id);
  await recordActivity({ userId: session.user.id, action: "jarvis_phone_code_created", targetType: "jarvis" });
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-jarvis-phone-settings", limit: 10, windowSeconds: 600 })) {
    return NextResponse.json({ error: "Too many settings changes. Please wait." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { outboundAlertsEnabled?: unknown; minimumSeverity?: unknown; quietHoursStart?: unknown; quietHoursEnd?: unknown } | null;
  const minimumSeverity = body?.minimumSeverity === "high" ? "high" : "critical";
  const quietHoursStart = Number(body?.quietHoursStart);
  const quietHoursEnd = Number(body?.quietHoursEnd);
  if (!Number.isInteger(quietHoursStart) || quietHoursStart < 0 || quietHoursStart > 23 || !Number.isInteger(quietHoursEnd) || quietHoursEnd < 0 || quietHoursEnd > 23) {
    return NextResponse.json({ error: "Quiet hours must use whole hours from 0 through 23." }, { status: 400 });
  }
  const settings = {
    outboundAlertsEnabled: body?.outboundAlertsEnabled === true,
    minimumSeverity,
    quietHoursStart,
    quietHoursEnd,
    timeZone: "America/Los_Angeles",
  } as const;
  if (settings.outboundAlertsEnabled && !jarvisPhoneConfiguration().outboundConfigured) {
    return NextResponse.json({ error: "Configure the Twilio number and alert phone before enabling calls." }, { status: 409 });
  }
  await updateJarvisPhoneSettings(session.user.id, settings);
  await recordActivity({ userId: session.user.id, action: "jarvis_phone_settings_changed", targetType: "jarvis", metadata: settings });
  return NextResponse.json({ ok: true, settings });
}
