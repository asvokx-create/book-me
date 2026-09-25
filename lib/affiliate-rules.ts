export function calculateEligibleProviderFeeRevenue(input: {
  providerMarketplaceFeeCents: number;
  bookingPriceCents: number;
  refundedServiceAmountCents: number;
}) {
  if (input.bookingPriceCents <= 0 || input.providerMarketplaceFeeCents <= 0) return 0;
  const remainingServiceRevenue = Math.max(0, input.bookingPriceCents - Math.max(0, input.refundedServiceAmountCents));
  return Math.max(0, Math.round(input.providerMarketplaceFeeCents * remainingServiceRevenue / input.bookingPriceCents));
}

export function calculateAffiliateCommission(eligibleRevenueCents: number, rateBasisPoints: number) {
  if (eligibleRevenueCents <= 0 || rateBasisPoints <= 0) return 0;
  return Math.max(0, Math.round(eligibleRevenueCents * Math.min(rateBasisPoints, 10_000) / 10_000));
}
