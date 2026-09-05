import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to set up payouts." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe test mode still needs to be connected by the BubsBookings administrator." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-connect", limit: 8 }))
    return NextResponse.json({ error: "Too many payout setup attempts. Please wait and try again." }, { status: 429 });
  const result = await database.query<{ id: string; business_name: string; stripe_account_id: string | null }>(
    "SELECT id::text, business_name, stripe_account_id FROM provider_profiles WHERE user_id = $1 AND is_active = true", [session.user.id],
  );
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Create your provider profile before setting up payouts." }, { status: 404 });
  const stripe = getStripe();
  let accountId = provider.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: session.user.email,
      business_profile: { name: provider.business_name, url: new URL(request.url).origin },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { providerId: provider.id, userId: session.user.id },
    });
    accountId = account.id;
    await database.query("UPDATE provider_profiles SET stripe_account_id = $2 WHERE id::text = $1", [provider.id, accountId]);
  }
  const origin = new URL(request.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/provider/dashboard/billing?stripe=connect-refresh`,
    return_url: `${origin}/provider/dashboard/billing?stripe=connect-return`,
  });
  return NextResponse.json({ url: link.url });
}
