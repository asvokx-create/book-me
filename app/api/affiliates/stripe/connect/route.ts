import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to set up affiliate payouts." }, { status: 401 });
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe payout setup is not available yet." }, { status: 503 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "affiliate-stripe-connect", limit: 8 }))
      return NextResponse.json({ error: "Too many payout setup attempts. Please wait and try again." }, { status: 429 });
    const result = await database.query<{ id: string; display_name: string; email: string; status: string; stripe_account_id: string | null; stripe_connect_mode: "test" | "live" | null }>(`SELECT id::text,display_name,email,status,stripe_account_id,stripe_connect_mode
      FROM affiliate_profiles WHERE user_id=$1 OR (user_id IS NULL AND lower(email)=lower($2))
      ORDER BY created_at DESC LIMIT 1`, [session.user.id, session.user.email]);
    const affiliate = result.rows[0];
    if (!affiliate || !["approved","active","paused"].includes(affiliate.status))
      return NextResponse.json({ error: "Your partner account must be approved before setting up payouts." }, { status: 403 });
    await database.query("UPDATE affiliate_profiles SET user_id=$1 WHERE id=$2::uuid AND user_id IS NULL", [session.user.id, affiliate.id]);
    const stripe = getStripe();
    const mode = getStripeMode();
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
    const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
    let accountId = affiliate.stripe_connect_mode === mode ? affiliate.stripe_account_id : null;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: affiliate.email,
        business_profile: { name: affiliate.display_name, url: origin },
        capabilities: { transfers: { requested: true } },
        tos_acceptance: { service_agreement: "recipient" },
        metadata: { affiliateId: affiliate.id, userId: session.user.id, kind: "affiliate_payout_recipient" },
      }, { idempotencyKey: `affiliate-connect-${mode}-v1-${affiliate.id}` });
      accountId = account.id;
      await database.query(`UPDATE affiliate_profiles SET stripe_account_id=$2,stripe_connect_mode=$3,
        stripe_details_submitted=false,stripe_payouts_enabled=false,stripe_requirements_due=ARRAY[]::text[],payment_status='not_ready'
        WHERE id::text=$1`, [affiliate.id, accountId, mode]);
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${origin}/affiliate?stripe=connect-refresh`,
      return_url: `${origin}/affiliate?stripe=connect-return`,
    });
    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Affiliate Stripe onboarding failed", error);
    return NextResponse.json({ error: "Stripe payout setup is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
