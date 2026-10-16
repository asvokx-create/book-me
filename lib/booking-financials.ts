export type BookingFinancialPlan = "starter" | "pro" | "business" | "owner";

export const DEFAULT_CUSTOMER_SERVICE_FEE_CENTS = 299;
export const CUSTOMER_REVIEW_PERIOD_MS = 48 * 60 * 60 * 1000;

const PROVIDER_FEE_BASIS_POINTS: Record<BookingFinancialPlan, number> = {
  starter: 1_000,
  pro: 600,
  business: 200,
  owner: 0,
};

// These caps apply to new Starter (the free plan) and Pro booking snapshots.
// Business and Owner are legacy/internal plans with separately configured terms,
// so their existing percentage behavior remains unchanged until their terms are
// explicitly revised.
const PROVIDER_FEE_CAP_CENTS: Record<BookingFinancialPlan, number | null> = {
  starter: 20_000,
  pro: 10_000,
  business: null,
  owner: null,
};

export type BookingFinancialSnapshot = {
  serviceSubtotalCents: number;
  customerServiceFeeCents: number;
  customerTotalCents: number;
  providerPlan: BookingFinancialPlan;
  providerFeeBasisPoints: number;
  providerFeeCapCents: number | null;
  providerFeeCents: number;
  providerNetCents: number;
};

function requireCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer number of cents.`);
}

export function providerFeeBasisPoints(plan: BookingFinancialPlan) {
  return PROVIDER_FEE_BASIS_POINTS[plan];
}

export function providerFeeCapCents(plan: BookingFinancialPlan) {
  return PROVIDER_FEE_CAP_CENTS[plan];
}

export function calculateProviderPlatformFeeCents(serviceSubtotalCents: number, feeBasisPoints: number, feeCapCents: number | null) {
  requireCents(serviceSubtotalCents, "Service subtotal");
  if (!Number.isSafeInteger(feeBasisPoints) || feeBasisPoints < 0 || feeBasisPoints > 10_000) {
    throw new RangeError("Provider fee basis points must be a whole number between 0 and 10,000.");
  }
  if (feeCapCents !== null) requireCents(feeCapCents, "Provider fee cap");
  const percentageFeeCents = Math.round(serviceSubtotalCents * feeBasisPoints / 10_000);
  return feeCapCents === null ? percentageFeeCents : Math.min(percentageFeeCents, feeCapCents);
}

export function calculateBookingFinancialSnapshot(
  serviceSubtotalCents: number,
  providerPlan: BookingFinancialPlan,
  customerServiceFeeCents = DEFAULT_CUSTOMER_SERVICE_FEE_CENTS,
): BookingFinancialSnapshot {
  requireCents(serviceSubtotalCents, "Service subtotal");
  requireCents(customerServiceFeeCents, "Customer service fee");
  const feeBasisPoints = providerFeeBasisPoints(providerPlan);
  const feeCapCents = providerFeeCapCents(providerPlan);
  const providerFeeCents = calculateProviderPlatformFeeCents(serviceSubtotalCents, feeBasisPoints, feeCapCents);
  return {
    serviceSubtotalCents,
    customerServiceFeeCents,
    customerTotalCents: serviceSubtotalCents + customerServiceFeeCents,
    providerPlan,
    providerFeeBasisPoints: feeBasisPoints,
    providerFeeCapCents: feeCapCents,
    providerFeeCents,
    providerNetCents: serviceSubtotalCents - providerFeeCents,
  };
}

export function providerNetAfterServiceRefund(snapshot: BookingFinancialSnapshot, refundedServiceCents: number) {
  requireCents(refundedServiceCents, "Refunded service amount");
  const remainingServiceCents = Math.max(0, snapshot.serviceSubtotalCents - refundedServiceCents);
  return remainingServiceCents - calculateProviderPlatformFeeCents(
    remainingServiceCents,
    snapshot.providerFeeBasisPoints,
    snapshot.providerFeeCapCents,
  );
}

/**
 * Stripe reports one fee for the platform charge, not a fee per Checkout line
 * item. Allocate the reported fee proportionally so the service portion is
 * borne by the provider and the $2.99 customer service-fee portion remains a
 * platform cost. This never invents a card-rate estimate and never exceeds the
 * Stripe fee actually reported for that charge.
 */
export function allocateProviderProcessingFeeCents(input: {
  stripeProcessingFeeCents: number;
  serviceSubtotalCents: number;
  customerTotalCents: number;
}) {
  requireCents(input.stripeProcessingFeeCents, "Stripe processing fee");
  requireCents(input.serviceSubtotalCents, "Service subtotal");
  if (!Number.isSafeInteger(input.customerTotalCents) || input.customerTotalCents < 1) {
    throw new RangeError("Customer total must be a positive integer number of cents.");
  }
  const providerProcessingFeeCents = Math.min(
    input.stripeProcessingFeeCents,
    Math.max(0, Math.round(input.stripeProcessingFeeCents * input.serviceSubtotalCents / input.customerTotalCents)),
  );
  return {
    providerProcessingFeeCents,
    platformProcessingFeeCents: input.stripeProcessingFeeCents - providerProcessingFeeCents,
  };
}

export function paymentReleaseStatusAfterPayment(input: { heldTransfer: boolean; serviceCompleted: boolean; frozen: boolean; paymentSucceeded: boolean }) {
  if (!input.paymentSucceeded) return "failed" as const;
  if (!input.heldTransfer) return "paid_out" as const;
  if (input.frozen) return "frozen" as const;
  return input.serviceCompleted ? "awaiting_customer" as const : "secured" as const;
}

export function isProviderPayoutEligible(input: {
  paymentStatus: string;
  bookingStatus: string;
  paymentReleaseStatus: string;
  hasOpenDispute: boolean;
  hasBlockingRefund: boolean;
  payoutFrozen: boolean;
  transferId: string | null;
}) {
  return input.paymentStatus === "paid"
    && input.bookingStatus === "completed"
    && ["secured", "awaiting_customer", "failed"].includes(input.paymentReleaseStatus)
    && !input.hasOpenDispute
    && !input.hasBlockingRefund
    && !input.payoutFrozen
    && !input.transferId;
}

export function stripeOperationKey(kind: "payout" | "refund" | "reversal", mode: "test" | "live", bookingId: string, version = "1") {
  return `booking-${kind}-${mode}-${bookingId}-${version}`;
}
