import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { AFFILIATE_COOKIE } from "@/lib/affiliates";
import { enforceRateLimit, publicRequestRateLimitKey } from "@/lib/request-security";

const anonymousEvents = new Map([
  ["signup_clicked", "signup_clicked_at=COALESCE(signup_clicked_at,now())"],
  ["signup_started", "signup_clicked_at=COALESCE(signup_clicked_at,now()), signup_started_at=COALESCE(signup_started_at,now())"],
]);
const authenticatedEvents = new Map([
  ["account_created", "account_created_at=COALESCE(account_created_at,now())"],
  ["onboarding_started", "onboarding_started_at=COALESCE(onboarding_started_at,now())"],
]);

function cookieValue(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return rawValue.join("=");
  }
  return null;
}

export async function POST(request: Request) {
  if (!await enforceRateLimit({ request, userId: publicRequestRateLimitKey(request), bucket: "affiliate-funnel", limit: 40 })) {
    return NextResponse.json({ error: "Too many referral tracking requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { eventName?: unknown } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const assignment = anonymousEvents.get(eventName) ?? authenticatedEvents.get(eventName);
  if (!assignment) return NextResponse.json({ error: "Unsupported referral event." }, { status: 400 });

  const token = cookieValue(request.headers.get("cookie"), AFFILIATE_COOKIE);
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ ok: true, ignored: true });

  if (authenticatedEvents.has(eventName)) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  // The assignment is selected only from the fixed allowlists above. COALESCE makes
  // retries harmless and preserves the first time each funnel stage occurred.
  await database.query(`UPDATE affiliate_clicks SET ${assignment} WHERE attribution_token=$1::uuid`, [token]);
  return NextResponse.json({ ok: true });
}
