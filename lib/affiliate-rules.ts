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

export function addCalendarMonthsClamped(value: Date, months: number) {
  if (!Number.isInteger(months) || months < 0) throw new RangeError("Months must be a non-negative integer.");
  const result = new Date(value);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function affiliateRevenueShareWindow(startedAt: Date, durationMonths: number) {
  const start = new Date(startedAt);
  if (!Number.isFinite(start.getTime())) throw new RangeError("Revenue-share start must be a valid date.");
  return { start, end: addCalendarMonthsClamped(start, durationMonths) };
}

export function isAffiliateRevenueShareActive(input: {
  startedAt: Date;
  durationMonths: number;
  at: Date;
}) {
  const at = new Date(input.at);
  if (!Number.isFinite(at.getTime())) throw new RangeError("Revenue-share check time must be a valid date.");
  const { start, end } = affiliateRevenueShareWindow(input.startedAt, input.durationMonths);
  return at >= start && at < end;
}
