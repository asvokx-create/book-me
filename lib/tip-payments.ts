import "server-only";

import { database } from "./database";
import { sendTransactionalEmail } from "./email";
import { getStripe, getStripeMode, isStripeReady } from "./stripe";

type TipReleaseResult =
  | { ok: true; released: boolean; transferId?: string }
  | { ok: false; error: string };

/**
 * Sends only the recorded tip amount to the provider's connected account. It
 * deliberately has no dependency on booking fees, Partner commissions, or the
 * provider's service payout.
 */
export async function releaseTipTransfer(tipId: string, options: { administratorApproved?: boolean } = {}): Promise<TipReleaseResult> {
  if (!isStripeReady()) return { ok: false, error: "Stripe is not configured." };

  const mode = getStripeMode();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`tip-payout:${tipId}`]);
    const claimed = await client.query<{
      id: string; booking_id: string; amount_cents: number; stripe_charge_id: string; stripe_account_id: string | null;
      provider_user_id: string; provider_email: string; service_title: string;
    }>(`UPDATE booking_tips tip SET transfer_status='pending',transfer_failure_reason=NULL,
          risk_status=CASE WHEN $3 THEN 'clear' ELSE risk_status END
       FROM bookings booking
       JOIN provider_profiles provider ON provider.id=tip.provider_id
       JOIN services service ON service.id=booking.service_id
       JOIN "user" provider_user ON provider_user.id=provider.user_id
       WHERE tip.id::text=$1 AND tip.booking_id=booking.id
         AND tip.payment_status='paid' AND tip.transfer_status IN ('not_ready','failed')
         AND (tip.risk_status='clear' OR $3)
         AND tip.stripe_mode=$2 AND tip.stripe_charge_id IS NOT NULL
         AND provider.stripe_connect_mode=$2 AND provider.stripe_payouts_enabled=true
       RETURNING tip.id::text,tip.booking_id::text,tip.amount_cents,tip.stripe_charge_id,provider.stripe_account_id,
         provider.user_id AS provider_user_id,provider_user.email AS provider_email,service.title AS service_title`,
      [tipId, mode, Boolean(options.administratorApproved)],
    );
    const tip = claimed.rows[0];
    if (!tip) {
      await client.query("ROLLBACK");
      return { ok: true, released: false };
    }
    if (!tip.stripe_account_id) {
      await client.query("UPDATE booking_tips SET transfer_status='failed',transfer_failure_reason='The provider payout account is not ready.' WHERE id::text=$1", [tipId]);
      await client.query("COMMIT");
      return { ok: false, error: "The provider payout account is not ready." };
    }
    let transfer;
    try {
      transfer = await getStripe().transfers.create({
        amount: tip.amount_cents,
        currency: "usd",
        destination: tip.stripe_account_id,
        source_transaction: tip.stripe_charge_id,
        transfer_group: `booking_${tip.booking_id}_tip`,
        metadata: { kind: "booking_tip_payout", tipId: tip.id, bookingId: tip.booking_id },
      }, { idempotencyKey: `tip-payout-${mode}-${tip.id}` });
    } catch (error) {
      await client.query("UPDATE booking_tips SET transfer_status='failed',transfer_failure_reason='Stripe could not release this tip to the provider.' WHERE id::text=$1", [tipId]);
      await client.query("COMMIT");
      console.error("Tip transfer failed", tipId, error);
      return { ok: false, error: "Stripe could not release this tip to the provider." };
    }
    await client.query("UPDATE booking_tips SET transfer_status='paid_out',stripe_transfer_id=$2,transferred_at=now(),transfer_failure_reason=NULL WHERE id::text=$1", [tip.id, transfer.id]);
    await client.query(`INSERT INTO booking_events (booking_id,event_type,message,metadata)
      VALUES ($1::uuid,'tip_paid_out','Customer tip released to the provider through Stripe.',jsonb_build_object('tipId',$2,'amountCents',$3,'transferId',$4))
      ON CONFLICT DO NOTHING`, [tip.booking_id, tip.id, tip.amount_cents, transfer.id]);
    await client.query(`INSERT INTO notifications (user_id,booking_id,type,title,message,href,dedupe_key)
      VALUES ($1,$2::uuid,'tip_received','You received a tip',$3,'/provider/dashboard/bookings/' || $2::uuid::text,'tip-received-' || $4)
      ON CONFLICT (dedupe_key) DO NOTHING`, [tip.provider_user_id, tip.booking_id, `A $${(tip.amount_cents / 100).toFixed(2)} tip for ${tip.service_title} was sent to your Stripe balance.`, tip.id]);
    await client.query("COMMIT");
    void sendTransactionalEmail({ to: tip.provider_email, userId: tip.provider_user_id, bookingId: tip.booking_id, emailType: "tip_received", idempotencyKey: `tip-received-${tip.id}`, subject: "You received a BubsBookings tip", heading: "You received a tip", message: `A $${(tip.amount_cents / 100).toFixed(2)} tip for ${tip.service_title} was sent to your Stripe balance.`, actionLabel: "View booking", actionUrl: `/provider/dashboard/bookings/${tip.booking_id}` });
    return { ok: true, released: true, transferId: transfer.id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Tip payout release failed", tipId, error);
    return { ok: false, error: "The tip payout could not be released." };
  } finally {
    client.release();
  }
}

export async function refundBookingTip(input: { tipId: string; approvedBy: string; amountCents: number }) {
  if (!isStripeReady()) return { ok: false as const, error: "Stripe is not configured." };
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) return { ok: false as const, error: "Enter a valid refund amount." };

  const mode = getStripeMode();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`tip-refund:${input.tipId}`]);
    const row = await client.query<{
      id: string; booking_id: string; amount_cents: number; refunded_amount_cents: number; stripe_payment_intent_id: string | null;
      stripe_transfer_id: string | null; customer_id: string; customer_email: string; provider_user_id: string; provider_email: string; service_title: string;
    }>(`SELECT tip.id::text,tip.booking_id::text,tip.amount_cents,tip.refunded_amount_cents,tip.stripe_payment_intent_id,
        tip.stripe_transfer_id,tip.customer_id,customer.email AS customer_email,provider.user_id AS provider_user_id,
        provider_user.email AS provider_email,service.title AS service_title
      FROM booking_tips tip
      JOIN bookings booking ON booking.id=tip.booking_id
      JOIN services service ON service.id=booking.service_id
      JOIN "user" customer ON customer.id=tip.customer_id
      JOIN provider_profiles provider ON provider.id=tip.provider_id
      JOIN "user" provider_user ON provider_user.id=provider.user_id
      WHERE tip.id::text=$1 AND tip.stripe_mode=$2 AND tip.payment_status IN ('paid','partially_refunded')
      FOR UPDATE`, [input.tipId, mode]);
    const tip = row.rows[0];
    if (!tip || !tip.stripe_payment_intent_id) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "This tip cannot be refunded from the current environment." };
    }
    const remaining = tip.amount_cents - tip.refunded_amount_cents;
    if (input.amountCents > remaining) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: `Choose an amount up to $${(remaining / 100).toFixed(2)}.` };
    }
    const totalRefunded = tip.refunded_amount_cents + input.amountCents;
    const fullyRefunded = totalRefunded >= tip.amount_cents;
    const refund = await getStripe().refunds.create({
      payment_intent: tip.stripe_payment_intent_id,
      amount: input.amountCents,
      metadata: { kind: "booking_tip_refund", tipId: tip.id, bookingId: tip.booking_id, approvedBy: input.approvedBy },
    }, { idempotencyKey: `tip-refund-${mode}-${tip.id}-total-${totalRefunded}` });

    let reversalNeedsReview = false;
    if (tip.stripe_transfer_id) {
      try {
        const transfer = await getStripe().transfers.retrieve(tip.stripe_transfer_id);
        const reversalAmount = Math.max(0, totalRefunded - transfer.amount_reversed);
        if (reversalAmount > 0) await getStripe().transfers.createReversal(tip.stripe_transfer_id, {
          amount: reversalAmount,
          metadata: { kind: "booking_tip_refund_reversal", tipId: tip.id, bookingId: tip.booking_id, stripeRefundId: refund.id },
        }, { idempotencyKey: `tip-reversal-${mode}-${tip.id}-total-${totalRefunded}` });
      } catch (error) {
        reversalNeedsReview = true;
        console.error("Tip transfer reversal failed after refund", tip.id, error);
      }
    }
    await client.query(`UPDATE booking_tips SET payment_status=CASE WHEN $3 THEN 'refunded' ELSE 'partially_refunded' END,
      refunded_amount_cents=$2,stripe_refund_id=$4,refunded_at=now(),
      transfer_failure_reason=CASE WHEN $5 THEN 'The customer was refunded, but the provider tip transfer needs manual recovery.' ELSE transfer_failure_reason END
      WHERE id::text=$1`, [tip.id, totalRefunded, fullyRefunded, refund.id, reversalNeedsReview]);
    await client.query(`INSERT INTO booking_events (booking_id,actor_user_id,event_type,message,metadata)
      VALUES ($1::uuid,$2,'tip_refunded','Customer tip refunded through Stripe.',jsonb_build_object('tipId',$3,'amountCents',$4,'stripeRefundId',$5,'reversalNeedsReview',$6))`,
      [tip.booking_id, input.approvedBy, tip.id, input.amountCents, refund.id, reversalNeedsReview]);
    await client.query(`INSERT INTO notifications (user_id,booking_id,type,title,message,href,dedupe_key)
      VALUES ($1,$2::uuid,'tip_refunded','Tip refunded',$3,'/account/bookings/' || $2::uuid::text,'tip-refunded-customer-' || $4 || '-' || $5),
             ($6,$2::uuid,'tip_refunded','Customer tip refunded',$7,'/provider/dashboard/bookings/' || $2::uuid::text,'tip-refunded-provider-' || $4 || '-' || $5)
      ON CONFLICT (dedupe_key) DO NOTHING`, [tip.customer_id, tip.booking_id,
      `$${(input.amountCents / 100).toFixed(2)} of your tip was returned to your original payment method.`, tip.id, totalRefunded, tip.provider_user_id,
      `$${(input.amountCents / 100).toFixed(2)} of a customer tip was refunded.`]);
    await client.query("COMMIT");
    void sendTransactionalEmail({ to: tip.customer_email, userId: tip.customer_id, bookingId: tip.booking_id, emailType: "tip_refund", idempotencyKey: `tip-refund-customer-${tip.id}-${totalRefunded}`, subject: "Your BubsBookings tip refund", heading: "Your tip was refunded", message: `$${(input.amountCents / 100).toFixed(2)} of your tip for ${tip.service_title} was returned to your original payment method.`, actionLabel: "View booking", actionUrl: `/account/bookings/${tip.booking_id}` });
    void sendTransactionalEmail({ to: tip.provider_email, userId: tip.provider_user_id, bookingId: tip.booking_id, emailType: "tip_refund_provider", idempotencyKey: `tip-refund-provider-${tip.id}-${totalRefunded}`, subject: "A customer tip was refunded", heading: "Customer tip refunded", message: `$${(input.amountCents / 100).toFixed(2)} of the tip for ${tip.service_title} was refunded.`, actionLabel: "View booking", actionUrl: `/provider/dashboard/bookings/${tip.booking_id}` });
    return { ok: true as const, refundId: refund.id, reversalNeedsReview };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Tip refund failed", input.tipId, error);
    return { ok: false as const, error: "Stripe could not complete this tip refund. No refund was issued." };
  } finally {
    client.release();
  }
}
