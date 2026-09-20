export type BookingFinancialPlan = "starter" | "pro" | "business" | "owner";

export const DEFAULT_CUSTOMER_SERVICE_FEE_CENTS = 299;
export const CUSTOMER_REVIEW_PERIOD_MS = 48 * 60 * 60 * 1000;

const PROVIDER_FEE_BASIS_POINTS: Record<BookingFinancialPlan, number> = {
  starter: 1_000,
  pro: 600,
  business: 200,
  owner: 0,
};

export type BookingFinancialSnapshot = {
  serviceSubtotalCents: number;
  customerServiceFeeCents: number;
  customerTotalCents: number;
  providerPlan: BookingFinancialPlan;
  providerFeeBasisPoints: number;
  providerFeeCents: number;
  providerNetCents: number;
};

function requireCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer number of cents.`);
}

export function providerFeeBasisPoints(plan: BookingFinancialPlan) {
  return PROVIDER_FEE_BASIS_POINTS[plan];
}

export function calculateBookingFinancialSnapshot(
  serviceSubtotalCents: number,
  providerPlan: BookingFinancialPlan,
  customerServiceFeeCents = DEFAULT_CUSTOMER_SERVICE_FEE_CENTS,
): BookingFinancialSnapshot {
  requireCents(serviceSubtotalCents, "Service subtotal");
  requireCents(customerServiceFeeCents, "Customer service fee");
  const feeBasisPoints = providerFeeBasisPoints(providerPlan);
  const providerFeeCents = Math.round(serviceSubtotalCents * feeBasisPoints / 10_000);
  return {
    serviceSubtotalCents,
    customerServiceFeeCents,
    customerTotalCents: serviceSubtotalCents + customerServiceFeeCents,
    providerPlan,
    providerFeeBasisPoints: feeBasisPoints,
    providerFeeCents,
    providerNetCents: serviceSubtotalCents - providerFeeCents,
  };
}

export function providerNetAfterServiceRefund(snapshot: BookingFinancialSnapshot, refundedServiceCents: number) {
  requireCents(refundedServiceCents, "Refunded service amount");
  const remainingServiceCents = Math.max(0, snapshot.serviceSubtotalCents - refundedServiceCents);
  return remainingServiceCents - Math.round(remainingServiceCents * snapshot.providerFeeBasisPoints / 10_000);
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
