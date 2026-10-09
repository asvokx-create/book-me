import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOrCreateConsumerStripeCustomer } from "@/lib/customer-stripe";
import { database } from "@/lib/database";
import { recordAnalytics } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { resolveTipSelection } from "@/lib/tips";

type TipRow = {
  id: string;
  payment_status: "pending" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded" | "disputed";
  stripe_checkout_session_id: string | null;
  attempt_number: number;
};

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to leave a tip." }, { status: 401 });
  if (!isStripeReady()) return NextResponse.json({ error: "Stripe payments are not available yet." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-booking-tip", limit: 6 }))
    return NextResponse.json({ error: "Too many tip attempts. Please wait a minute and try again." }, { status: 429 });

  const { bookingId } = await context.params;
  const body = await request.json().catch(() => null) as { type?: unknown; percentage?: unknown; amountCents?: unknown; highTipConfirmed?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Choose a valid tip amount." }, { status: 400 });
  const mode = getStripeMode();
  const client = await database.connect();
  let tip: { id: string; amountCents: number; type: "percentage" | "custom"; percentage: number | null; attemptNumber: number } | null = null;
  let existingCheckoutId: string | null = null;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`booking-tip:${bookingId}`]);
    const bookingResult = await client.query<{
      id: string; customer_id: string; provider_id: string; service_title: string; business_name: string; price_cents: number;
      status: string; payment_status: string; payment_flow: string | null; stripe_mode: "test" | "live" | null;
      stripe_payment_intent_id: string | null; stripe_charge_id: string | null; stripe_account_id: string | null;
      stripe_connect_mode: "test" | "live" | null; stripe_payouts_enabled: boolean;
    }>(`SELECT b.id::text,b.customer_id,b.provider_id::text,s.title AS service_title,s.business_name,b.price_cents,
        b.status,b.payment_status,b.payment_flow,b.stripe_mode,b.stripe_payment_intent_id,b.stripe_charge_id,
        p.stripe_account_id,p.stripe_connect_mode,p.stripe_payouts_enabled
      FROM bookings b JOIN services s ON s.id=b.service_id JOIN provider_profiles p ON p.id=b.provider_id
      WHERE b.id::text=$1 AND b.customer_id=$2 FOR UPDATE OF b`, [bookingId, session.user.id]);
    const booking = bookingResult.rows[0];
    if (!booking) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
    if (booking.status !== "completed" || booking.payment_status !== "paid" || booking.payment_flow !== "held_transfer_v1"
      || booking.stripe_mode !== mode || !booking.stripe_payment_intent_id || !booking.stripe_charge_id
      || !booking.stripe_account_id || booking.stripe_connect_mode !== mode || !booking.stripe_payouts_enabled) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This completed booking is not eligible for a tip." }, { status: 409 });
    }

    const existing = await client.query<TipRow>("SELECT id::text,payment_status,stripe_checkout_session_id,attempt_number FROM booking_tips WHERE booking_id::text=$1 FOR UPDATE", [bookingId]);
    const current = existing.rows[0];
    if (current?.payment_status === "paid" || current?.payment_status === "partially_refunded" || current?.payment_status === "refunded" || current?.payment_status === "disputed") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A tip has already been submitted for this booking." }, { status: 409 });
    }
    if (current?.payment_status === "pending") {
      if (!current.stripe_checkout_session_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Your tip checkout is already being prepared. Please wait a moment." }, { status: 409 });
      }
      existingCheckoutId = current.stripe_checkout_session_id;
      await client.query("COMMIT");
    } else {
      let selection;
      try {
        selection = resolveTipSelection({
          type: body.type,
          percentage: body.percentage,
          amountCents: body.amountCents,
          highTipConfirmed: body.highTipConfirmed,
          serviceSubtotalCents: booking.price_cents,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: error instanceof Error ? error.message : "Choose a valid tip amount." }, { status: 400 });
      }
      const riskStatus = selection.amountCents * 10_000 > booking.price_cents * 5_000 ? "review" : "clear";
      const saved = await client.query<{ id: string; attempt_number: number }>(`INSERT INTO booking_tips
          (booking_id,customer_id,provider_id,currency,amount_cents,tip_type,percentage,stripe_mode,payment_status,transfer_status,risk_status)
        VALUES ($1::uuid,$2,$3::uuid,'usd',$4,$5,$6,$7,'pending','not_ready',$8)
        ON CONFLICT (booking_id) DO UPDATE SET amount_cents=EXCLUDED.amount_cents,tip_type=EXCLUDED.tip_type,
          percentage=EXCLUDED.percentage,stripe_mode=EXCLUDED.stripe_mode,payment_status='pending',transfer_status='not_ready',
          failure_reason=NULL,transfer_failure_reason=NULL,stripe_checkout_session_id=NULL,stripe_payment_intent_id=NULL,
          stripe_charge_id=NULL,stripe_transfer_id=NULL,risk_status=EXCLUDED.risk_status,attempt_number=booking_tips.attempt_number+1
        WHERE booking_tips.payment_status IN ('failed','cancelled')
        RETURNING id::text,attempt_number`, [bookingId, session.user.id, booking.provider_id, selection.amountCents, selection.type, selection.percentage, mode, riskStatus]);
      if (!saved.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This tip can no longer be updated." }, { status: 409 });
      }
      tip = { id: saved.rows[0].id, amountCents: selection.amountCents, type: selection.type, percentage: selection.percentage, attemptNumber: saved.rows[0].attempt_number };
      await client.query("COMMIT");

      const stripe = getStripe();
      const account = await stripe.accounts.retrieve(booking.stripe_account_id);
      await database.query("UPDATE provider_profiles SET stripe_payouts_enabled=$2 WHERE stripe_account_id=$1 AND stripe_connect_mode=$3", [booking.stripe_account_id, account.payouts_enabled, mode]);
      if (!account.payouts_enabled) {
        await database.query("UPDATE booking_tips SET payment_status='failed',failure_reason='The provider payout account is not ready.' WHERE id::text=$1 AND payment_status='pending'", [tip.id]);
        return NextResponse.json({ error: "This provider is not ready to receive a tip yet." }, { status: 409 });
      }
      const customerId = await getOrCreateConsumerStripeCustomer({ userId: session.user.id, email: session.user.email, name: session.user.name });
      const origin = new URL(request.url).origin;
      const checkout = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        // Tips are transferred from their own source charge as soon as Stripe
        // confirms payment. Restricting this to card payments avoids delayed
        // payment-method failures after the provider transfer is scheduled.
        payment_method_types: ["card"],
        saved_payment_method_options: { payment_method_save: "enabled" },
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: tip.amountCents, product_data: {
          name: `Tip for ${booking.service_title}`,
          description: "100% goes to the provider. BubsBookings covers payment processing costs.",
        } } }],
        payment_intent_data: {
          transfer_group: `booking_${booking.id}_tip`,
          metadata: { kind: "booking_tip", bookingId: booking.id, tipId: tip.id, providerId: booking.provider_id, customerId: session.user.id, tipType: tip.type, ...(tip.percentage ? { percentage: String(tip.percentage) } : {}) },
        },
        metadata: { kind: "booking_tip", bookingId: booking.id, tipId: tip.id, providerId: booking.provider_id, customerId: session.user.id, tipType: tip.type, ...(tip.percentage ? { percentage: String(tip.percentage) } : {}) },
        success_url: `${origin}/account/bookings/${booking.id}?tip=success`,
        cancel_url: `${origin}/account/bookings/${booking.id}?tip=cancelled`,
      }, { idempotencyKey: `tip-checkout-${mode}-${tip.id}-${tip.attemptNumber}` });
      await database.query("UPDATE booking_tips SET stripe_checkout_session_id=$2 WHERE id::text=$1 AND payment_status='pending'", [tip.id, checkout.id]);
      await recordAnalytics({ eventName: "tip_checkout_started", userId: session.user.id, targetType: "booking", targetId: booking.id, metadata: { tipAmountCents: tip.amountCents } });
      return NextResponse.json({ url: checkout.url });
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (tip) await database.query("UPDATE booking_tips SET payment_status='failed',failure_reason='Tip checkout could not be created.' WHERE id::text=$1 AND payment_status='pending'", [tip.id]).catch(() => undefined);
    console.error("Tip checkout could not be prepared", error);
    return NextResponse.json({ error: "We could not prepare a tip checkout. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }

  if (!existingCheckoutId) return NextResponse.json({ error: "We could not prepare a tip checkout. Please try again." }, { status: 500 });
  try {
    const checkout = await getStripe().checkout.sessions.retrieve(existingCheckoutId);
    if (checkout.status === "open" && checkout.url && checkout.metadata?.kind === "booking_tip") return NextResponse.json({ url: checkout.url });
    await database.query("UPDATE booking_tips SET payment_status='cancelled',failure_reason='The previous tip checkout was not completed.' WHERE stripe_checkout_session_id=$1 AND payment_status='pending'", [existingCheckoutId]);
    return NextResponse.json({ error: "That tip checkout has closed. Please choose your tip again." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "We could not reopen the tip checkout. Please try again." }, { status: 502 });
  }
}
