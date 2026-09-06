import "server-only";

import { database } from "./database";
import { getStripe, getStripeMode, isStripeReady } from "./stripe";

export const CUSTOMER_CONFIRMATION_HOURS = 48;

type ReleaseResult =
  | { ok: true; released: boolean; transferId?: string }
  | { ok: false; error: string };

export async function releaseBookingPayout(bookingId: string, trigger: "customer" | "automatic" | "admin"): Promise<ReleaseResult> {
  if (!isStripeReady()) return { ok: false, error: "Stripe is not configured." };

  const claimed = await database.query<{
    id: string; customer_id: string; provider_user_id: string; provider_name: string; service_title: string;
    provider_payout_cents: number; stripe_account_id: string | null; stripe_charge_id: string | null;
    stripe_mode: "test" | "live" | null;
  }>(`UPDATE bookings b SET payment_release_status = 'processing', payout_failure_reason = NULL
      FROM provider_profiles p, services s
      WHERE b.id::text = $1 AND p.id = b.provider_id AND s.id = b.service_id
        AND b.payment_status = 'paid' AND b.stripe_mode = $2
        AND b.payment_release_status IN ('secured', 'awaiting_customer', 'failed')
        AND b.status = 'completed' AND b.payout_frozen_at IS NULL
        AND b.refund_status NOT IN ('requested', 'processing')
        AND NOT EXISTS (
          SELECT 1 FROM booking_disputes d
          WHERE d.booking_id = b.id AND d.status IN ('open', 'reviewing')
        )
      RETURNING b.id::text, b.customer_id, p.user_id AS provider_user_id,
        s.business_name AS provider_name, s.title AS service_title,
        b.provider_payout_cents, p.stripe_account_id, b.stripe_charge_id, b.stripe_mode`,
    [bookingId, getStripeMode()]);
  const booking = claimed.rows[0];
  if (!booking) return { ok: false, error: "This payout is not ready, is frozen, or has an open refund or dispute." };
  if (!booking.stripe_account_id || !booking.stripe_charge_id || booking.provider_payout_cents < 1) {
    await database.query("UPDATE bookings SET payment_release_status = 'failed', payout_failure_reason = $2 WHERE id::text = $1", [bookingId, "Missing provider payout details."]);
    return { ok: false, error: "The provider payout details are incomplete." };
  }

  try {
    const transfer = await getStripe().transfers.create({
      amount: booking.provider_payout_cents,
      currency: "usd",
      destination: booking.stripe_account_id,
      source_transaction: booking.stripe_charge_id,
      transfer_group: `booking_${booking.id}`,
      metadata: { bookingId: booking.id, kind: "provider_payout", releaseTrigger: trigger },
    }, { idempotencyKey: `booking-payout-${getStripeMode()}-${booking.id}` });

    await database.query(`UPDATE bookings SET payment_release_status = 'paid_out', stripe_transfer_id = $2,
      payout_released_at = now(), payout_failure_reason = NULL WHERE id::text = $1`, [bookingId, transfer.id]);
    await database.query(`INSERT INTO booking_events (booking_id, event_type, message, metadata)
      VALUES ($1::uuid, 'payout_released', $2, jsonb_build_object('transferId', $3, 'trigger', $4))`,
      [bookingId, `Provider payout of $${(booking.provider_payout_cents / 100).toFixed(2)} was released through Stripe.`, transfer.id, trigger]);
    await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
      VALUES ($1, $2::uuid, 'payout_released', 'Payout released', $3,
      '/provider/dashboard/bookings/' || $2::uuid::text, 'payout-released-' || $2::uuid::text)
      ON CONFLICT (dedupe_key) DO NOTHING`,
      [booking.provider_user_id, bookingId, `$${(booking.provider_payout_cents / 100).toFixed(2)} for ${booking.service_title} was sent to your Stripe balance.`]);
    return { ok: true, released: true, transferId: transfer.id };
  } catch (error) {
    console.error("Provider payout release failed", bookingId, error);
    await database.query("UPDATE bookings SET payment_release_status = 'failed', payout_failure_reason = $2 WHERE id::text = $1", [bookingId, "Stripe could not release this payout. An administrator can retry it."]);
    return { ok: false, error: "Stripe could not release this payout. An administrator can retry it." };
  }
}

export async function releaseDuePayouts(limit = 50) {
  const due = await database.query<{ id: string }>(`SELECT id::text FROM bookings
    WHERE payment_release_status IN ('awaiting_customer', 'failed')
      AND completion_confirmation_due_at IS NOT NULL
      AND completion_confirmation_due_at <= now()
      AND payout_frozen_at IS NULL
    ORDER BY completion_confirmation_due_at ASC LIMIT $1`, [limit]);
  let released = 0;
  const failed: string[] = [];
  for (const booking of due.rows) {
    const result = await releaseBookingPayout(booking.id, "automatic");
    if (result.ok && result.released) released += 1;
    else if (!result.ok) failed.push(booking.id);
  }
  await database.query("INSERT INTO operations_checks (check_type, status, details) VALUES ('payment_releases', $1, $2::jsonb)",
    [failed.length ? "warning" : "ok", JSON.stringify({ eligible: due.rowCount, released, failed })]);
  return { eligible: due.rowCount, released, failed };
}

export async function refundUnreleasedBooking(bookingId: string, reason: string) {
  if (!isStripeReady()) return { ok: false, error: "Stripe is not configured." } as const;
  const claimed = await database.query<{
    customer_id: string; provider_name: string; service_title: string; stripe_payment_intent_id: string;
    price_cents: number; refunded_amount_cents: number;
  }>(`UPDATE bookings b SET refund_status = 'processing', refund_reason = $2,
      refund_requested_at = COALESCE(b.refund_requested_at, now()),
      refund_amount_cents = b.price_cents - b.refunded_amount_cents,
      refund_failure_reason = NULL
    FROM provider_profiles p, services s
    WHERE b.id::text = $1 AND p.id = b.provider_id AND s.id = b.service_id
      AND b.payment_flow = 'held_transfer_v1' AND b.payment_status = 'paid'
      AND b.stripe_mode = $3 AND b.stripe_payment_intent_id IS NOT NULL AND b.stripe_transfer_id IS NULL
      AND b.refunded_amount_cents < b.price_cents AND b.refund_status <> 'processing'
    RETURNING b.customer_id, s.business_name AS provider_name, s.title AS service_title,
      b.stripe_payment_intent_id, b.price_cents, b.refunded_amount_cents`, [bookingId, reason, getStripeMode()]);
  const booking = claimed.rows[0];
  if (!booking) return { ok: true, refunded: false } as const;
  const amount = booking.price_cents - booking.refunded_amount_cents;
  try {
    const refund = await getStripe().refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount,
      metadata: { bookingId, kind: "automatic_cancellation_refund" },
    }, { idempotencyKey: `booking-auto-refund-${getStripeMode()}-${bookingId}` });
    await database.query(`UPDATE bookings SET refund_status = 'refunded', stripe_refund_id = $2,
      refunded_amount_cents = price_cents, refunded_at = now(), payment_status = 'refunded',
      payment_release_status = 'reversed', provider_payout_cents = 0 WHERE id::text = $1`, [bookingId, refund.id]);
    await database.query(`INSERT INTO booking_events (booking_id, event_type, message, metadata)
      VALUES ($1::uuid, 'refunded', 'Payment automatically refunded before provider payout.',
      jsonb_build_object('amountCents', $2::integer, 'stripeRefundId', $3))`, [bookingId, amount, refund.id]);
    await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
      VALUES ($1, $2::uuid, 'refund_approved', 'Payment refunded', $3,
      '/account/bookings/' || $2::uuid::text, 'automatic-refund-' || $2::uuid::text)
      ON CONFLICT (dedupe_key) DO NOTHING`, [booking.customer_id, bookingId, `$${(amount / 100).toFixed(2)} for ${booking.service_title} was returned to your original payment method.`]);
    return { ok: true, refunded: true, amount } as const;
  } catch (error) {
    console.error("Automatic held payment refund failed", bookingId, error);
    await database.query(`UPDATE bookings SET refund_status = 'failed',
      refund_failure_reason = 'The automatic refund needs administrator attention.' WHERE id::text = $1`, [bookingId]);
    return { ok: false, error: "The booking was cancelled, but its automatic refund needs administrator attention." } as const;
  }
}
