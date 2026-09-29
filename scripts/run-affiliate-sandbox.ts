import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import Stripe from "stripe";
import {
  affiliateRevenueShareWindow,
  calculateAffiliateCommission,
  calculateEligibleProviderFeeRevenue,
  isAffiliateRevenueShareActive,
} from "../lib/affiliate-rules.ts";
import { calculateBookingFinancialSnapshot } from "../lib/booking-financials.ts";

const STANDARD_TERMS = {
  activationBonusCents: 1_000,
  revenueShareBasisPoints: 2_000,
  revenueShareDurationMonths: 6,
  holdPeriodDays: 14,
} as const;

type SandboxOptions = {
  startedAt?: Date;
  bookingAt?: Date;
  servicePriceCents?: number;
  runStripe?: boolean;
};

export async function runAffiliateSandbox(options: SandboxOptions = {}) {
  const startedAt = options.startedAt ?? new Date("2026-01-31T12:00:00.000Z");
  const bookingAt = options.bookingAt ?? new Date("2026-02-01T12:00:00.000Z");
  const servicePriceCents = options.servicePriceCents ?? 25_000;
  const snapshot = calculateBookingFinancialSnapshot(servicePriceCents, "starter");
  const shareWindow = affiliateRevenueShareWindow(startedAt, STANDARD_TERMS.revenueShareDurationMonths);
  const eligibleFeeRevenueCents = calculateEligibleProviderFeeRevenue({
    providerMarketplaceFeeCents: snapshot.providerFeeCents,
    bookingPriceCents: snapshot.serviceSubtotalCents,
    refundedServiceAmountCents: 0,
  });
  const shareIsActive = isAffiliateRevenueShareActive({
    startedAt,
    durationMonths: STANDARD_TERMS.revenueShareDurationMonths,
    at: bookingAt,
  });
  const revenueShareCents = shareIsActive ? calculateAffiliateCommission(eligibleFeeRevenueCents, STANDARD_TERMS.revenueShareBasisPoints) : 0;
  const payableAt = new Date(bookingAt.getTime() + STANDARD_TERMS.holdPeriodDays * 86_400_000);

  assert.equal(snapshot.providerFeeCents, 2_500, "Starter provider fee must be 10% of a $250 service");
  assert.equal(snapshot.providerNetCents, 22_500, "Provider must receive the remaining $225");
  assert.equal(revenueShareCents, shareIsActive ? 500 : 0, "Affiliate must receive exactly 20% only while the six-month window is active");
  assert.equal(STANDARD_TERMS.activationBonusCents, 1_000, "Activation bonus must remain $10");
  assert.equal(payableAt.getTime() - bookingAt.getTime(), 14 * 86_400_000, "Commission must remain held for 14 days");
  assert.equal(isAffiliateRevenueShareActive({ startedAt, durationMonths: 6, at: shareWindow.end }), false, "No revenue share may accrue at or after the six-month endpoint");
  assert.equal(calculateAffiliateCommission(eligibleFeeRevenueCents, STANDARD_TERMS.revenueShareBasisPoints), 500);
  assert.equal(calculateAffiliateCommission(eligibleFeeRevenueCents, 2_100) > 500, true, "The test must detect a rate above 20%");

  let stripePaymentIntentId: string | null = null;
  if (options.runStripe) {
    const secret = process.env.STRIPE_SECRET_KEY ?? "";
    if (!secret.startsWith("sk_test_")) throw new Error("STRIPE_SECRET_KEY must be a Stripe sandbox/test key. Live keys are refused.");
    const stripe = new Stripe(secret);
    const intent = await stripe.paymentIntents.create({
      amount: snapshot.customerTotalCents,
      currency: "usd",
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      metadata: {
        kind: "affiliate_end_to_end_sandbox",
        affiliateRateBasisPoints: String(STANDARD_TERMS.revenueShareBasisPoints),
        affiliateDurationMonths: String(STANDARD_TERMS.revenueShareDurationMonths),
        affiliateHoldDays: String(STANDARD_TERMS.holdPeriodDays),
      },
    }, { idempotencyKey: `affiliate-sandbox-${startedAt.toISOString()}-${servicePriceCents}` });
    assert.equal(intent.livemode, false, "Sandbox bot must never create a live payment");
    assert.equal(intent.status, "succeeded", "Stripe sandbox payment must succeed");
    stripePaymentIntentId = intent.id;
  }

  return {
    mode: options.runStripe ? "stripe-test" : "local-simulation",
    actors: { affiliate: "sandbox-affiliate", provider: "sandbox-provider", customer: "sandbox-customer" },
    attribution: { locked: true, source: "affiliate-link", termsSnapshotted: true },
    purchase: {
      servicePriceCents: snapshot.serviceSubtotalCents,
      customerServiceFeeCents: snapshot.customerServiceFeeCents,
      customerTotalCents: snapshot.customerTotalCents,
      providerMarketplaceFeeCents: snapshot.providerFeeCents,
      providerPayoutCents: snapshot.providerNetCents,
      stripePaymentIntentId,
    },
    affiliate: {
      activationBonusCents: STANDARD_TERMS.activationBonusCents,
      eligibleFeeRevenueCents,
      revenueShareBasisPoints: STANDARD_TERMS.revenueShareBasisPoints,
      revenueShareCents,
      totalHeldCents: STANDARD_TERMS.activationBonusCents + revenueShareCents,
      holdPeriodDays: STANDARD_TERMS.holdPeriodDays,
      payableAt: payableAt.toISOString(),
      revenueShareStartedAt: shareWindow.start.toISOString(),
      revenueShareEndsAt: shareWindow.end.toISOString(),
      earnsAtExactEnd: false,
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runStripe = process.argv.includes("--stripe");
  const report = await runAffiliateSandbox({ runStripe });
  console.log(JSON.stringify(report, null, 2));
}
