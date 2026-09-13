import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to manage your provider plan." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-subscription-manage", limit: 8 })) {
    return NextResponse.json({ error: "Too many plan changes. Please wait and try again." }, { status: 429 });
  }
  if (!isStripeReady()) return NextResponse.json({ error: "Stripe billing is temporarily unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "cancel" && action !== "resume") {
    return NextResponse.json({ error: "Choose a valid subscription action." }, { status: 400 });
  }

  const result = await database.query<{
    id: string;
    stripe_subscription_id: string | null;
    stripe_billing_mode: "test" | "live" | null;
    plan: string;
  }>(`SELECT id::text, stripe_subscription_id, stripe_billing_mode, plan
      FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  if (provider.plan === "owner") return NextResponse.json({ error: "The Owner Plan has no subscription charge to cancel." }, { status: 409 });
  if (!provider.stripe_subscription_id || provider.stripe_billing_mode !== getStripeMode()) {
    return NextResponse.json({ error: "No current subscription was found." }, { status: 404 });
  }

  const stripe = getStripe();
  const existing = await stripe.subscriptions.retrieve(provider.stripe_subscription_id);
  if (existing.metadata.providerId !== provider.id) {
    return NextResponse.json({ error: "This subscription could not be verified for your provider account." }, { status: 403 });
  }
  if (!["active", "trialing", "past_due", "unpaid", "paused"].includes(existing.status)) {
    return NextResponse.json({ error: "This subscription is no longer active." }, { status: 409 });
  }

  const cancelAtPeriodEnd = action === "cancel";
  const subscription = existing.cancel_at_period_end === cancelAtPeriodEnd
    ? existing
    : await stripe.subscriptions.update(existing.id, { cancel_at_period_end: cancelAtPeriodEnd });
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
  await database.query(`UPDATE provider_profiles SET stripe_subscription_status = $2,
      stripe_current_period_end = CASE WHEN $3::bigint IS NULL THEN NULL ELSE to_timestamp($3) END
      WHERE id::text = $1 AND stripe_subscription_id = $4 AND stripe_billing_mode = $5`,
  [provider.id, subscription.status, periodEnd, subscription.id, getStripeMode()]);
  await recordActivity({
    userId: session.user.id,
    action: cancelAtPeriodEnd ? "provider_subscription_cancellation_scheduled" : "provider_subscription_cancellation_reversed",
    targetType: "provider_subscription",
    targetId: subscription.id,
    metadata: { currentPeriodEnd: periodEnd },
  });

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  });
}
