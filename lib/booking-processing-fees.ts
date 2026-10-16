import "server-only";

import type Stripe from "stripe";
import { allocateProviderProcessingFeeCents } from "./booking-financials";
import { database } from "./database";
import { getStripe, getStripeMode, isStripeReady } from "./stripe";

type ChargeFeeResult =
  | { status: "final"; stripeProcessingFeeCents: number }
  | { status: "pending" };

function expandedBalanceTransaction(charge: Stripe.Charge) {
  return typeof charge.balance_transaction === "object" && charge.balance_transaction !== null
    ? charge.balance_transaction
    : null;
}

async function chargeFee(chargeId: string): Promise<ChargeFeeResult> {
  if (!isStripeReady()) return { status: "pending" };
  try {
    const charge = await getStripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] });
    const balanceTransaction = expandedBalanceTransaction(charge);
    if (!balanceTransaction || !Number.isSafeInteger(balanceTransaction.fee) || balanceTransaction.fee < 0) {
      return { status: "pending" };
    }
    return { status: "final", stripeProcessingFeeCents: balanceTransaction.fee };
  } catch (error) {
    // A charge can be paid before Stripe makes its balance transaction
    // retrievable. Keep the transfer held and retry at payout release rather
    // than guessing a processing rate or exposing Stripe internals.
    console.error("Booking processing-fee lookup deferred", { chargeId, error });
    return { status: "pending" };
  }
}

export type ProcessingFeeReconciliation =
  | { status: "final"; stripeProcessingFeeCents: number; providerProcessingFeeCents: number; providerPayoutCents: number }
  | { status: "pending" };

/**
 * Finalizes a booking's processing-fee allocation from Stripe's charge balance
 * transaction. The charge stays on the platform under the existing separate
 * charges/transfers model; this function never creates a second fee or changes
 * the Stripe charge type.
 */
export async function reconcileBookingProcessingFee(bookingId: string, knownChargeId?: string | null): Promise<ProcessingFeeReconciliation> {
  const bookingResult = await database.query<{
    stripe_charge_id: string | null; price_cents: number; customer_total_cents: number | null;
    platform_fee_cents: number; stripe_processing_fee_cents: number | null;
    provider_processing_fee_cents: number; provider_payout_cents: number; processing_fee_status: string;
  }>(`SELECT stripe_charge_id, price_cents, customer_total_cents, platform_fee_cents,
      stripe_processing_fee_cents, provider_processing_fee_cents, provider_payout_cents, processing_fee_status
    FROM bookings WHERE id::text = $1 AND stripe_mode = $2`, [bookingId, getStripeMode()]);
  const booking = bookingResult.rows[0];
  if (!booking) return { status: "pending" };
  if (booking.processing_fee_status === "final" && booking.stripe_processing_fee_cents !== null) {
    return {
      status: "final",
      stripeProcessingFeeCents: booking.stripe_processing_fee_cents,
      providerProcessingFeeCents: booking.provider_processing_fee_cents,
      providerPayoutCents: booking.provider_payout_cents,
    };
  }
  const chargeId = knownChargeId ?? booking.stripe_charge_id;
  if (!chargeId || !booking.customer_total_cents) return { status: "pending" };
  const fee = await chargeFee(chargeId);
  if (fee.status !== "final") {
    await database.query(`UPDATE bookings SET processing_fee_status = 'pending'
      WHERE id::text = $1 AND stripe_mode = $2 AND processing_fee_status <> 'final'`, [bookingId, getStripeMode()]);
    return fee;
  }
  const allocation = allocateProviderProcessingFeeCents({
    stripeProcessingFeeCents: fee.stripeProcessingFeeCents,
    serviceSubtotalCents: booking.price_cents,
    customerTotalCents: booking.customer_total_cents,
  });
  const providerPayoutCents = Math.max(0, booking.price_cents - booking.platform_fee_cents - allocation.providerProcessingFeeCents);
  await database.query(`UPDATE bookings SET stripe_processing_fee_cents = $2,
      provider_processing_fee_cents = $3, provider_payout_cents = $4, processing_fee_status = 'final'
    WHERE id::text = $1 AND stripe_mode = $5 AND processing_fee_status <> 'final'`,
  [bookingId, fee.stripeProcessingFeeCents, allocation.providerProcessingFeeCents, providerPayoutCents, getStripeMode()]);
  return {
    status: "final",
    stripeProcessingFeeCents: fee.stripeProcessingFeeCents,
    providerProcessingFeeCents: allocation.providerProcessingFeeCents,
    providerPayoutCents,
  };
}
