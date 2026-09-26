import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to view payout setup." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "affiliate-stripe-status", limit: 20 }))
    return NextResponse.json({ error: "Too many Stripe status checks. Please wait and try again." }, { status: 429 });
  const result = await database.query<{ id: string; stripe_account_id: string | null; stripe_connect_mode: "test" | "live" | null; tax_onboarding_status: string }>(`SELECT id::text,stripe_account_id,stripe_connect_mode,tax_onboarding_status
    FROM affiliate_profiles WHERE user_id=$1 OR (user_id IS NULL AND lower(email)=lower($2))
    ORDER BY created_at DESC LIMIT 1`, [session.user.id, session.user.email]);
  const affiliate = result.rows[0];
  if (!affiliate) return NextResponse.json({ connected: false, state: "not_available" });
  const mode = getStripeMode();
  if (!affiliate.stripe_account_id || affiliate.stripe_connect_mode !== mode)
    return NextResponse.json({ connected: false, state: "not_started", taxState: affiliate.tax_onboarding_status });
  try {
    const account = await getStripe().accounts.retrieve(affiliate.stripe_account_id);
    const requirements = account.requirements?.currently_due ?? [];
    const transferActive = account.capabilities?.transfers === "active";
    const ready = Boolean(account.details_submitted && account.payouts_enabled && transferActive && requirements.length === 0);
    await database.query(`UPDATE affiliate_profiles SET stripe_details_submitted=$2,stripe_payouts_enabled=$3,
      stripe_requirements_due=$4,payment_status=$5 WHERE id::text=$1`,
    [affiliate.id, account.details_submitted, account.payouts_enabled, requirements, ready ? "ready" : "not_ready"]);
    return NextResponse.json({ connected: true, state: ready ? "ready" : requirements.length ? "action_needed" : "in_review", taxState: affiliate.tax_onboarding_status, requirementsCount: requirements.length });
  } catch (error) {
    console.error("Affiliate Stripe status refresh failed", error);
    return NextResponse.json({ connected: true, state: "unavailable", taxState: affiliate.tax_onboarding_status }, { status: 502 });
  }
}
