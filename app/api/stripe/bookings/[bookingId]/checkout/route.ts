import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateConsumerStripeCustomer } from "@/lib/customer-stripe";
import { database } from "@/lib/database";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/request-security";
import { recordAnalytics } from "@/lib/analytics";
import { BOOKING_CHECKOUT_VERSION, CUSTOMER_SERVICE_FEE_CENTS } from "@/lib/booking-fees";

export async function POST(request: Request, context: RouteContext<"/api/stripe/bookings/[bookingId]/checkout">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to pay for this booking." }, { status: 401 });
  if (!isStripeReady()) return NextResponse.json({ error: "Secure payments are not available yet." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-booking-checkout", limit: 8 }))
    return NextResponse.json({ error: "Too many payment attempts. Please wait and try again." }, { status: 429 });
  const { bookingId } = await context.params;
  const result = await database.query<{
    id: string; title: string; provider_name: string; price_cents: number; status: string;
    payment_status: string; quote_status: string; plan: ProviderPlan; stripe_account_id: string | null;
    stripe_connect_mode: "test" | "live" | null; stripe_mode: "test" | "live" | null;
    stripe_checkout_session_id: string | null; payment_flow: string | null;
  }>(`SELECT b.id::text, s.title, s.business_name AS provider_name, b.price_cents, b.status,
      b.payment_status, b.quote_status, p.plan, p.stripe_account_id, p.stripe_connect_mode, b.stripe_mode,
      b.stripe_checkout_session_id, b.payment_flow
    FROM bookings b JOIN services s ON s.id = b.service_id JOIN provider_profiles p ON p.id = b.provider_id
    WHERE b.id::text = $1 AND b.customer_id = $2`, [bookingId, session.user.id]);
  const booking = result.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "confirmed" && booking.status !== "completed") return NextResponse.json({ error: "The provider must confirm this booking before payment." }, { status: 409 });
  if (booking.quote_status === "pending" || booking.quote_status === "declined") return NextResponse.json({ error: "Resolve the custom quote before payment." }, { status: 409 });
  const mode = getStripeMode();
  if (booking.stripe_mode === mode && booking.payment_status === "paid") return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
  if (!booking.stripe_account_id || booking.stripe_connect_mode !== mode) return NextResponse.json({ error: "This provider has not finished payout setup yet." }, { status: 409 });
  if (booking.price_cents < 50) return NextResponse.json({ error: "This booking total is too low for online payment." }, { status: 409 });

  const stripe = getStripe();
  if (booking.stripe_mode === mode && booking.payment_status === "pending" && booking.stripe_checkout_session_id) {
    const existing = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
    if (existing.status === "open" && existing.url
      && existing.metadata?.paymentFlow === "held_transfer_v1"
      && existing.metadata?.checkoutVersion === BOOKING_CHECKOUT_VERSION
      && existing.metadata?.customerServiceFeeCents === String(CUSTOMER_SERVICE_FEE_CENTS)) {
      return NextResponse.json({ url: existing.url });
    }
    if (existing.status === "open") await stripe.checkout.sessions.expire(existing.id).catch(() => undefined);
  }
  const account = await stripe.accounts.retrieve(booking.stripe_account_id);
  await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1 AND stripe_connect_mode = $4", [booking.stripe_account_id, account.charges_enabled, account.payouts_enabled, mode]);
  if (!account.charges_enabled || !account.payouts_enabled) return NextResponse.json({ error: "This provider is still finishing secure payout verification." }, { status: 409 });

  const fee = Math.round(booking.price_cents * PLAN_ENTITLEMENTS[booking.plan].bookingFeePercent / 100);
  const providerPayout = booking.price_cents - fee;
  const origin = new URL(request.url).origin;
  const customerId = await getOrCreateConsumerStripeCustomer({
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    saved_payment_method_options: { payment_method_save: "enabled" },
    line_items: [
      { quantity: 1, price_data: { currency: "usd", unit_amount: booking.price_cents, product_data: { name: booking.title, description: `Service from ${booking.provider_name}` } } },
      { quantity: 1, price_data: { currency: "usd", unit_amount: CUSTOMER_SERVICE_FEE_CENTS, product_data: { name: "BubsBookings service fee", description: "Secure marketplace checkout and booking support" } } },
    ],
    payment_intent_data: {
      transfer_group: `booking_${booking.id}`,
      metadata: { kind: "booking_payment", bookingId: booking.id, paymentFlow: "held_transfer_v1", checkoutVersion: BOOKING_CHECKOUT_VERSION, customerServiceFeeCents: String(CUSTOMER_SERVICE_FEE_CENTS) },
    },
    success_url: `${origin}/account/bookings/${booking.id}?payment=success`,
    cancel_url: `${origin}/account/bookings/${booking.id}?payment=cancelled`,
    metadata: { kind: "booking_payment", bookingId: booking.id, paymentFlow: "held_transfer_v1", checkoutVersion: BOOKING_CHECKOUT_VERSION, customerServiceFeeCents: String(CUSTOMER_SERVICE_FEE_CENTS) },
  });
  await database.query(`UPDATE bookings SET stripe_checkout_session_id = $2, stripe_payment_intent_id = NULL,
    stripe_charge_id = NULL, stripe_transfer_id = NULL, stripe_mode = $3, payment_status = 'pending',
    payment_flow = 'held_transfer_v1', payment_release_status = 'awaiting_payment',
    platform_fee_cents = $4, provider_payout_cents = $5, customer_service_fee_cents = $6,
    customer_service_fee_refunded_cents = 0, paid_at = NULL,
    completion_confirmation_due_at = NULL, customer_confirmed_at = NULL, payout_released_at = NULL,
    payout_failure_reason = NULL, payout_frozen_at = NULL, payout_frozen_by = NULL, payout_freeze_reason = NULL
    WHERE id::text = $1`, [booking.id, checkout.id, mode, fee, providerPayout, CUSTOMER_SERVICE_FEE_CENTS]);
  await recordAnalytics({ eventName: "checkout_started", userId: session.user.id, targetType: "booking", targetId: booking.id, metadata: { serviceAmountCents: booking.price_cents, customerServiceFeeCents: CUSTOMER_SERVICE_FEE_CENTS, amountCents: booking.price_cents + CUSTOMER_SERVICE_FEE_CENTS } });
  return NextResponse.json({ url: checkout.url });
}
