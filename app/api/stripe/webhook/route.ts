import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { database } from "@/lib/database";
import { isProviderPlan } from "@/lib/plans";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function idOf(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function updateSubscription(subscription: Stripe.Subscription) {
  const providerId = subscription.metadata.providerId;
  const plan = subscription.metadata.plan;
  if (!providerId || !isProviderPlan(plan) || plan === "starter") return;
  const active = subscription.status === "active" || subscription.status === "trialing";
  const periodEnd = subscription.items.data[0]?.current_period_end;
  await database.query(`UPDATE provider_profiles SET
      plan = CASE WHEN $4 THEN $3 ELSE 'starter' END,
      stripe_subscription_id = $2,
      stripe_subscription_status = $5,
      stripe_current_period_end = CASE WHEN $6::bigint IS NULL THEN NULL ELSE to_timestamp($6) END
    WHERE id::text = $1`, [providerId, subscription.id, plan, active, subscription.status, periodEnd ?? null]);
}

async function processEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const checkout = event.data.object;
      if (checkout.metadata?.kind === "booking_payment" && checkout.metadata.bookingId && checkout.payment_status === "paid") {
        await database.query(`UPDATE bookings SET payment_status = 'paid', stripe_payment_intent_id = $2, paid_at = now()
          WHERE id::text = $1 AND stripe_checkout_session_id = $3`, [checkout.metadata.bookingId, idOf(checkout.payment_intent), checkout.id]);
        await database.query(`INSERT INTO booking_events (booking_id, event_type, message, metadata)
          VALUES ($1::uuid, 'payment_received', 'Secure payment received through Stripe.', jsonb_build_object('checkoutSessionId', $2))`, [checkout.metadata.bookingId, checkout.id]);
      }
      break;
    }
    case "checkout.session.async_payment_failed": {
      const checkout = event.data.object;
      if (checkout.metadata?.bookingId) await database.query("UPDATE bookings SET payment_status = 'failed' WHERE id::text = $1 AND stripe_checkout_session_id = $2", [checkout.metadata.bookingId, checkout.id]);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await updateSubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await database.query(`UPDATE provider_profiles SET plan = 'starter', stripe_subscription_status = $2,
        stripe_current_period_end = NULL WHERE stripe_subscription_id = $1`, [subscription.id, subscription.status]);
      break;
    }
    case "account.updated": {
      const account = event.data.object;
      await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1", [account.id, account.charges_enabled, account.payouts_enabled]);
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      if (charge.refunded) await database.query("UPDATE bookings SET payment_status = 'refunded', refunded_at = now() WHERE stripe_payment_intent_id = $1", [idOf(charge.payment_intent)]);
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      await database.query("UPDATE bookings SET payment_status = 'failed' WHERE stripe_payment_intent_id = $1 OR id::text = $2", [paymentIntent.id, paymentIntent.metadata.bookingId ?? ""]);
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
