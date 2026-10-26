import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { AFFILIATE_COOKIE } from "@/lib/affiliates";
import { enforceRateLimit, publicRequestRateLimitKey } from "@/lib/request-security";
import { classifyAffiliateTraffic } from "@/lib/affiliate-traffic";

const anonymousEvents = new Map([
  ["signup_clicked", "signup_clicked_at=COALESCE(signup_clicked_at,now())"],
  ["signup_started", "signup_clicked_at=COALESCE(signup_clicked_at,now()), signup_started_at=COALESCE(signup_started_at,now())"],
  ["signup_submitted", "signup_submitted_at=COALESCE(signup_submitted_at,now())"],
]);
const authenticatedEvents = new Map([
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
  const body = await request.json().catch(() => null) as { eventName?: unknown; authMethod?: unknown; failureCategory?: unknown } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  const assignment = anonymousEvents.get(eventName) ?? authenticatedEvents.get(eventName);
  if (!assignment && eventName !== "account_created" && eventName !== "signup_failed") return NextResponse.json({ error: "Unsupported referral event." }, { status: 400 });

  const token = cookieValue(request.headers.get("cookie"), AFFILIATE_COOKIE);
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ ok: true, ignored: true });

  if (eventName === "signup_failed") {
    const allowedMethods = new Set(["email", "google", "unknown"]);
    const allowedCategories = new Set([
      "age_eligibility", "agreement", "location", "validation", "account_exists",
      "rate_limited", "oauth", "network", "authentication", "unknown",
    ]);
    const authMethod = typeof body?.authMethod === "string" && allowedMethods.has(body.authMethod) ? body.authMethod : "unknown";
    const failureCategory = typeof body?.failureCategory === "string" && allowedCategories.has(body.failureCategory) ? body.failureCategory : "unknown";
    const traffic = classifyAffiliateTraffic(request.headers.get("user-agent"));
    await database.query(
      `INSERT INTO affiliate_signup_failures
        (click_id, affiliate_id, program_id, auth_method, failure_category, device_category, browser_category)
       SELECT click.id, click.affiliate_id, click.program_id, $2, $3, $4, $5
       FROM affiliate_clicks click WHERE click.attribution_token=$1::uuid`,
      [token, authMethod, failureCategory, traffic.deviceCategory, traffic.browserCategory],
    );
    return NextResponse.json({ ok: true });
  }

  if (authenticatedEvents.has(eventName) || eventName === "account_created") {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (eventName === "account_created") {
      await database.query(
        `UPDATE affiliate_clicks click
         SET account_created_at=COALESCE(click.account_created_at,now()),
             account_user_id=COALESCE(click.account_user_id,account.id)
         FROM "user" account
         WHERE click.attribution_token=$1::uuid AND account.id=$2
           AND account."createdAt" >= click.created_at
           AND (click.account_user_id IS NULL OR click.account_user_id=account.id)`,
        [token, session.user.id],
      );
      return NextResponse.json({ ok: true });
    }
  }

  // The assignment is selected only from the fixed allowlists above. COALESCE makes
  // retries harmless and preserves the first time each funnel stage occurred.
  await database.query(`UPDATE affiliate_clicks SET ${assignment} WHERE attribution_token=$1::uuid`, [token]);
  return NextResponse.json({ ok: true });
}
