import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getStripe, isStripeReady } from "@/lib/stripe";
import { enforceRateLimit } from "@/lib/request-security";

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
  }>(`SELECT b.id::text, s.title, p.business_name AS provider_name, b.price_cents, b.status,
      b.payment_status, b.quote_status, p.plan, p.stripe_account_id
    FROM bookings b JOIN services s ON s.id = b.service_id JOIN provider_profiles p ON p.id = b.provider_id
    WHERE b.id::text = $1 AND b.customer_id = $2`, [bookingId, session.user.id]);
  const booking = result.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "confirmed") return NextResponse.json({ error: "The provider must confirm this booking before payment." }, { status: 409 });
  if (booking.quote_status === "pending" || booking.quote_status === "declined") return NextResponse.json({ error: "Resolve the custom quote before payment." }, { status: 409 });
  if (booking.payment_status === "paid") return NextResponse.json({ error: "This booking is already paid." }, { status: 409 });
  if (!booking.stripe_account_id) return NextResponse.json({ error: "This provider has not finished payout setup yet." }, { status: 409 });
  if (booking.price_cents < 50) return NextResponse.json({ error: "This booking total is too low for online payment." }, { status: 409 });

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(booking.stripe_account_id);
  await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1", [booking.stripe_account_id, account.charges_enabled, account.payouts_enabled]);
  if (!account.charges_enabled || !account.payouts_enabled) return NextResponse.json({ error: "This provider is still finishing secure payout verification." }, { status: 409 });

  const fee = Math.round(booking.price_cents * PLAN_ENTITLEMENTS[booking.plan].bookingFeePercent / 100);
  const origin = new URL(request.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: session.user.email,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: booking.price_cents, product_data: { name: booking.title, description: `Service from ${booking.provider_name}` } } }],
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: booking.stripe_account_id },
      metadata: { kind: "booking_payment", bookingId: booking.id },
    },
    success_url: `${origin}/account/bookings/${booking.id}?payment=success`,
    cancel_url: `${origin}/account/bookings/${booking.id}?payment=cancelled`,
    metadata: { kind: "booking_payment", bookingId: booking.id },
  });
  await database.query("UPDATE bookings SET stripe_checkout_session_id = $2, payment_status = 'pending' WHERE id::text = $1", [booking.id, checkout.id]);
  return NextResponse.json({ url: checkout.url });
}
