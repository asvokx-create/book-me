import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getComplimentaryProHistory, getComplimentaryProStatus, grantComplimentaryPro, reconcileExpiredComplimentaryProGrants, revokeComplimentaryPro } from "@/lib/complimentary-pro";
import { isComplimentaryProDuration } from "@/lib/complimentary-pro-policy";
import { enforceRateLimit } from "@/lib/request-security";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  const known: Record<string, [string, number]> = {
    PROVIDER_NOT_FOUND: ["Provider profile not found.", 404],
    PAID_SUBSCRIPTION_ACTIVE: ["This provider already has a paid Pro subscription. The Stripe subscription was not changed.", 409],
    PLAN_ALREADY_INCLUDED: ["This provider already has a plan that includes Pro benefits.", 409],
    LIFETIME_ALREADY_ACTIVE: ["This provider already has lifetime complimentary Pro.", 409],
    NO_ACTIVE_GRANT: ["This provider does not have an active complimentary Pro grant.", 409],
  };
  const match = known[code];
  return NextResponse.json({ error: match?.[0] ?? "The complimentary Pro change could not be completed." }, { status: match?.[1] ?? 500 });
}

export async function GET(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-complimentary-pro-read", limit: 120 })) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }
  const { providerId } = await params;
  if (!uuidPattern.test(providerId)) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  await reconcileExpiredComplimentaryProGrants(providerId);
  return NextResponse.json({ status: await getComplimentaryProStatus(providerId), history: await getComplimentaryProHistory(providerId) });
}

export async function POST(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-complimentary-pro-write", limit: 20 })) {
    return NextResponse.json({ error: "Too many changes. Please wait a minute." }, { status: 429 });
  }
  const { providerId } = await params;
  if (!uuidPattern.test(providerId)) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  let body: { action?: unknown; duration?: unknown; customDays?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a valid request." }, { status: 400 }); }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length > 500) return NextResponse.json({ error: "The internal reason must be 500 characters or fewer." }, { status: 400 });
  try {
    if (body.action === "revoke") {
      await revokeComplimentaryPro({ providerId, administratorId: session.user.id, reason });
    } else if (body.action === "grant" && isComplimentaryProDuration(body.duration)) {
      const customDays = typeof body.customDays === "number" ? body.customDays : undefined;
      if (body.duration === "custom" && (!Number.isInteger(customDays) || customDays! < 1 || customDays! > 3650)) {
        return NextResponse.json({ error: "Choose a custom duration from 1 to 3,650 days." }, { status: 400 });
      }
      await grantComplimentaryPro({ providerId, administratorId: session.user.id, duration: body.duration, customDays, reason });
    } else {
      return NextResponse.json({ error: "Choose a valid complimentary Pro action and duration." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, status: await getComplimentaryProStatus(providerId), history: await getComplimentaryProHistory(providerId) });
  } catch (error) {
    console.error("Complimentary Pro admin change failed", error instanceof Error ? error.message : "UNKNOWN");
    return errorResponse(error);
  }
}
