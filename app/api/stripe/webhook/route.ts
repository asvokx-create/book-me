import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { database } from "@/lib/database";
import { isPurchasableProviderPlan } from "@/lib/plans";
import { getStripe, getStripeMode } from "@/lib/stripe";
import { recordAnalytics } from "@/lib/analytics";
import { runAutomatedProviderVerification } from "@/lib/provider-verification";
import { extraSeatQuantity } from "@/lib/stripe-team-seats";

export const runtime = "nodejs";

function idOf(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function updateSubscription(subscription: Stripe.Subscription) {
  const providerId = subscription.metadata.providerId;
  const plan = subscription.metadata.plan;
  if (!providerId || !isPurchasableProviderPlan(plan)) return;
  const active = subscription.status === "active" || subscription.status === "trialing";
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const teamSeats = extraSeatQuantity(subscription);
  await database.query(`UPDATE provider_profiles SET
      plan = CASE WHEN $4 THEN $3 ELSE 'starter' END,
      stripe_subscription_id = $2,
      stripe_subscription_status = $5,
      stripe_current_period_end = CASE WHEN $6::bigint IS NULL THEN NULL ELSE to_timestamp($6) END,
      stripe_billing_mode = $7,
      extra_team_seats = CASE WHEN $4 THEN $8 ELSE 0 END,
      stripe_team_seat_item_id = CASE WHEN $4 THEN $9 ELSE NULL END
    WHERE id::text = $1 AND plan <> 'owner'`, [providerId, subscription.id, plan, active, subscription.status, periodEnd ?? null, getStripeMode(), teamSeats.quantity, teamSeats.itemId]);
}

async function markBookingPaid(checkout: Stripe.Checkout.Session) {
  if (checkout.metadata?.kind !== "booking_payment" || !checkout.metadata.bookingId) return;
  const paymentIntentId = idOf(checkout.payment_intent);
  let chargeId: string | null = null;
  if (paymentIntentId) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    chargeId = idOf(paymentIntent.latest_charge);
  }
  const heldTransfer = checkout.metadata.paymentFlow === "held_transfer_v1";
  const customerServiceFeeCents = Math.max(0, Number.parseInt(checkout.metadata.customerServiceFeeCents ?? "0", 10) || 0);
  const updated = await database.query(`UPDATE bookings SET payment_status = 'paid', stripe_payment_intent_id = $2,
      stripe_charge_id = $5, stripe_mode = $4, paid_at = now(),
      customer_service_fee_cents = $7,
      payment_release_status = CASE
        WHEN $6 AND payout_frozen_at IS NOT NULL THEN 'frozen'
        WHEN $6 AND status = 'completed' THEN 'awaiting_customer'
        WHEN $6 THEN 'secured'
        ELSE 'paid_out' END,
      completion_confirmation_due_at = CASE
        WHEN $6 AND status = 'completed' THEN now() + interval '48 hours'
        ELSE completion_confirmation_due_at END,
      payout_released_at = CASE WHEN $6 THEN NULL ELSE now() END
    WHERE id::text = $1 AND stripe_checkout_session_id = $3 AND stripe_mode = $4 AND payment_status <> 'paid'
    RETURNING id`, [checkout.metadata.bookingId, paymentIntentId, checkout.id, getStripeMode(), chargeId, heldTransfer, customerServiceFeeCents]);
  if (!updated.rowCount) return;
  await database.query(`INSERT INTO booking_events (booking_id, event_type, message, metadata)
    VALUES ($1::uuid, 'payment_received', 'Secure payment received through Stripe.', jsonb_build_object('checkoutSessionId', $2))`, [checkout.metadata.bookingId, checkout.id]);
  await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
    SELECT p.user_id, b.id, 'booking_payment', 'Customer payment received',
      '$' || to_char((b.price_cents - b.platform_fee_cents)::numeric / 100, 'FM999999990.00') || ' is secured for ' || s.title || '.',
      '/provider/dashboard/bookings/' || b.id::text, 'payment-received-' || b.id::text || '-provider'
    FROM bookings b JOIN provider_profiles p ON p.id = b.provider_id JOIN services s ON s.id = b.service_id
    WHERE b.id::text = $1 ON CONFLICT (dedupe_key) DO NOTHING`, [checkout.metadata.bookingId]);
  await recordAnalytics({ eventName: "payment_completed", targetType: "booking", targetId: checkout.metadata.bookingId, metadata: { amountTotal: checkout.amount_total } });
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const checkout = event.data.object;
      if (checkout.payment_status === "paid") await markBookingPaid(checkout);
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      await markBookingPaid(event.data.object);
      break;
    }
    case "checkout.session.async_payment_failed": {
      const checkout = event.data.object;
      if (checkout.metadata?.bookingId) await database.query("UPDATE bookings SET payment_status = 'failed' WHERE id::text = $1 AND stripe_checkout_session_id = $2 AND stripe_mode = $3", [checkout.metadata.bookingId, checkout.id, getStripeMode()]);
      break;
    }
    case "checkout.session.expired": {
      const checkout = event.data.object;
      if (checkout.metadata?.kind === "booking_payment" && checkout.metadata.bookingId) {
        await database.query("UPDATE bookings SET payment_status = 'unpaid' WHERE id::text = $1 AND stripe_checkout_session_id = $2 AND stripe_mode = $3 AND payment_status = 'pending'", [checkout.metadata.bookingId, checkout.id, getStripeMode()]);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await updateSubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await database.query(`UPDATE provider_profiles SET plan = 'starter', stripe_subscription_status = $2,
        stripe_current_period_end = NULL, extra_team_seats = 0, stripe_team_seat_item_id = NULL
        WHERE stripe_subscription_id = $1 AND stripe_billing_mode = $3 AND plan <> 'owner'`, [subscription.id, subscription.status, getStripeMode()]);
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      const provider = await database.query<{ id: string }>("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1 AND stripe_connect_mode = $4 RETURNING id::text", [account.id, account.charges_enabled, account.payouts_enabled, getStripeMode()]);
      if (provider.rows[0]) await runAutomatedProviderVerification(provider.rows[0].id);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      await database.query(`UPDATE bookings SET
        payment_status = CASE WHEN $3 THEN 'refunded' ELSE payment_status END,
        refund_status = 'refunded',
        refunded_amount_cents = LEAST(price_cents, $4),
        customer_service_fee_refunded_cents = LEAST(customer_service_fee_cents, GREATEST($4 - price_cents, 0)),
        refunded_at = now()
        WHERE stripe_payment_intent_id = $1 AND stripe_mode = $2`, [idOf(charge.payment_intent), getStripeMode(), charge.refunded, charge.amount_refunded]);
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      await database.query("UPDATE bookings SET payment_status = 'failed' WHERE stripe_mode = $3 AND (stripe_payment_intent_id = $1 OR id::text = $2)", [paymentIntent.id, paymentIntent.metadata.bookingId ?? "", getStripeMode()]);
      break;
    }
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!webhookSecret || !signature) return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature failed", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const claimed = await database.query(`INSERT INTO stripe_webhook_events (id, event_type)
    VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id`, [event.id, event.type]);
  if (!claimed.rowCount) return NextResponse.json({ received: true, duplicate: true });
  try {
    await processEvent(event);
    await database.query("UPDATE stripe_webhook_events SET status = 'processed', processed_at = now() WHERE id = $1", [event.id]);
    return NextResponse.json({ received: true });
  } catch (error) {
    await database.query("DELETE FROM stripe_webhook_events WHERE id = $1", [event.id]);
    console.error("Stripe webhook processing failed", event.type, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
