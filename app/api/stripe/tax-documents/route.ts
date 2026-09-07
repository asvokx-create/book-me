import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to manage tax information." }, { status: 401 });
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe tax reporting is not configured yet." }, { status: 503 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-tax-documents", limit: 8 })) {
      return NextResponse.json({ error: "Too many tax-document requests. Please wait and try again." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({})) as { action?: unknown };
    const action = body.action === "dashboard" ? "dashboard" : "setup";
    const result = await database.query<{ stripe_account_id: string | null; stripe_connect_mode: "test" | "live" | null }>(
      "SELECT stripe_account_id, stripe_connect_mode FROM provider_profiles WHERE user_id = $1 AND is_active = true",
      [session.user.id],
    );
    const provider = result.rows[0];
    const mode = getStripeMode();
    if (!provider?.stripe_account_id || provider.stripe_connect_mode !== mode) {
      return NextResponse.json({ error: "Set up your Stripe payout account before managing tax documents." }, { status: 409 });
    }

    const stripe = getStripe();
    if (action === "dashboard") {
      const loginLink = await stripe.accounts.createLoginLink(provider.stripe_account_id);
      return NextResponse.json({ url: loginLink.url });
    }

    await stripe.accounts.update(provider.stripe_account_id, {
      capabilities: { tax_reporting_us_1099_k: { requested: true } },
    });
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
    const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create({
      account: provider.stripe_account_id,
      type: "account_onboarding",
      refresh_url: `${origin}/provider/dashboard/billing?stripe=tax-refresh`,
      return_url: `${origin}/provider/dashboard/billing?stripe=tax-return`,
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe tax document access failed", error);
    return NextResponse.json({ error: "Stripe tax reporting is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
