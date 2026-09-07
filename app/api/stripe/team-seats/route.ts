import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { EXTRA_TEAM_SEAT_PRICE_CENTS, getTeamSeatPriceId, MAX_EXTRA_TEAM_SEATS, extraSeatQuantity } from "@/lib/stripe-team-seats";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to manage team seats." }, { status: 401 });
    if (!isStripeReady()) return NextResponse.json({ error: "Stripe billing is not configured." }, { status: 503 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-team-seats", limit: 8 })) {
      return NextResponse.json({ error: "Too many seat changes. Please wait and try again." }, { status: 429 });
    }
    const body = await request.json() as { extraSeats?: unknown };
    const extraSeats = Number(body.extraSeats);
    if (!Number.isInteger(extraSeats) || extraSeats < 0 || extraSeats > MAX_EXTRA_TEAM_SEATS) {
      return NextResponse.json({ error: `Choose between 0 and ${MAX_EXTRA_TEAM_SEATS} extra employees.` }, { status: 400 });
    }

    const providerResult = await database.query<{
      id: string; plan: string; stripe_subscription_id: string | null; stripe_subscription_status: string;
      stripe_billing_mode: "test" | "live" | null;
    }>(`SELECT id::text, plan, stripe_subscription_id, stripe_subscription_status, stripe_billing_mode
      FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
    const provider = providerResult.rows[0];
    if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
    if (provider.plan !== "pro") return NextResponse.json({ error: "Extra employee seats are available with the Pro plan." }, { status: 403 });
    if (!provider.stripe_subscription_id || provider.stripe_billing_mode !== getStripeMode() || !["active", "trialing"].includes(provider.stripe_subscription_status)) {
      return NextResponse.json({ error: "An active Pro subscription is required before adding paid employee seats." }, { status: 409 });
    }

    const workerCount = await database.query<{ count: number }>(
      "SELECT count(DISTINCT lower(email))::int AS count FROM provider_team_members WHERE provider_id = $1 AND status = 'active'",
      [provider.id],
    );
    const minimumExtraSeats = Math.max(workerCount.rows[0].count - 2, 0);
    if (extraSeats < minimumExtraSeats) {
      return NextResponse.json({ error: `Remove ${minimumExtraSeats - extraSeats} employee${minimumExtraSeats - extraSeats === 1 ? "" : "s"} before reducing your paid seats.` }, { status: 409 });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(provider.stripe_subscription_id);
    if (!["active", "trialing"].includes(subscription.status)) {
      return NextResponse.json({ error: "Your Pro subscription must be active before changing employee seats." }, { status: 409 });
    }
    const current = extraSeatQuantity(subscription);
    let itemId = current.itemId;
    if (extraSeats === 0 && itemId) {
      await stripe.subscriptionItems.del(itemId, { proration_behavior: "create_prorations" });
      itemId = null;
    } else if (extraSeats > 0) {
      if (itemId) {
        await stripe.subscriptionItems.update(itemId, { quantity: extraSeats, proration_behavior: "create_prorations" });
      } else {
        const item = await stripe.subscriptionItems.create({
          subscription: subscription.id,
          price: await getTeamSeatPriceId(),
          quantity: extraSeats,
          proration_behavior: "create_prorations",
          metadata: { kind: "pro_extra_team_seat", providerId: provider.id },
        });
        itemId = item.id;
      }
    }
    await database.query("UPDATE provider_profiles SET extra_team_seats = $2, stripe_team_seat_item_id = $3, updated_at = now() WHERE id::text = $1", [provider.id, extraSeats, itemId]);
    return NextResponse.json({ extraTeamSeats: extraSeats, totalTeamSeats: 3 + extraSeats, monthlyAddOnCents: extraSeats * EXTRA_TEAM_SEAT_PRICE_CENTS });
  } catch (error) {
    console.error("Pro team seat update failed", error);
    return NextResponse.json({ error: "We could not update your employee seats in Stripe. Please try again." }, { status: 502 });
  }
}
