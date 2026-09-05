import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin";
import { database } from "@/lib/database";
import { isProviderPlan } from "@/lib/plans";
import { getStripe, getStripePriceId, isStripeReady } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to choose a provider plan." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-subscription-checkout", limit: 6 }))
    return NextResponse.json({ error: "Too many checkout attempts. Please wait and try again." }, { status: 429 });
  if (!isStripeReady()) return NextResponse.json({ error: "Stripe test mode still needs to be connected by the BubsBookings administrator." }, { status: 503 });
  const body = await request.json() as { plan?: unknown };
  if (!isProviderPlan(body.plan) || body.plan === "starter") return NextResponse.json({ error: "Choose Pro or Business." }, { status: 400 });
  if (await hasAdminAccess(session.user.id, session.user.email)) return NextResponse.json({ error: "Your admin account already includes Business at no charge." }, { status: 409 });

  const providerResult = await database.query<{ id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }>(
    "SELECT id::text, stripe_customer_id, stripe_subscription_id FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const provider = providerResult.rows[0];
  if (!provider) return NextResponse.json({ error: "Create your provider profile before choosing a paid plan." }, { status: 404 });
  if (provider.stripe_subscription_id) return NextResponse.json({ error: "Manage your existing plan from the billing portal." }, { status: 409 });

  const stripe = getStripe();
  let customerId = provider.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name,
      metadata: { userId: session.user.id, providerId: provider.id },
    });
    customerId = customer.id;
    await database.query("UPDATE provider_profiles SET stripe_customer_id = $2 WHERE id::text = $1", [provider.id, customerId]);
  }

  const origin = new URL(request.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: provider.id,
    line_items: [{ price: getStripePriceId(body.plan), quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/provider/dashboard/billing?stripe=subscription-success`,
    cancel_url: `${origin}/provider/dashboard/billing?stripe=cancelled`,
    metadata: { kind: "provider_subscription", providerId: provider.id, plan: body.plan },
    subscription_data: { metadata: { kind: "provider_subscription", providerId: provider.id, plan: body.plan } },
  });
  return NextResponse.json({ url: checkout.url });
}
