export const ACTIVE_PROVIDER_REQUIRED_BOOKINGS = 4;

export const STANDARD_PROVIDER_GROWTH_MILESTONES = [
  { threshold: 10, bonusCents: 5_000 },
  { threshold: 25, bonusCents: 10_000 },
  { threshold: 50, bonusCents: 25_000 },
  { threshold: 100, bonusCents: 50_000 },
] as const;

export type ProviderGrowthMilestone = { threshold: number; bonusCents: number };

export function qualifiesAsActiveProvider(qualifiedPaidBookingCount: number) {
  return Number.isInteger(qualifiedPaidBookingCount) && qualifiedPaidBookingCount >= ACTIVE_PROVIDER_REQUIRED_BOOKINGS;
}

export function milestoneConfig(thresholds: number[], bonuses: number[]): ProviderGrowthMilestone[] {
  return thresholds
    .map((threshold, index) => ({ threshold: Number(threshold), bonusCents: Number(bonuses[index] ?? 0) }))
    .filter((item) => Number.isInteger(item.threshold) && item.threshold > 0 && Number.isInteger(item.bonusCents) && item.bonusCents >= 0)
    .sort((left, right) => left.threshold - right.threshold);
}

export function nextProviderGrowthMilestone(activeProviderCount: number, milestones: ProviderGrowthMilestone[]) {
  return milestones.find((milestone) => milestone.threshold > activeProviderCount) ?? null;
}

export function milestoneProgressPercent(activeProviderCount: number, milestones: ProviderGrowthMilestone[]) {
  const next = nextProviderGrowthMilestone(activeProviderCount, milestones);
  if (!next) return 100;
  const previous = [...milestones].reverse().find((milestone) => milestone.threshold <= activeProviderCount)?.threshold ?? 0;
  return Math.max(0, Math.min(100, Math.round(((activeProviderCount - previous) / (next.threshold - previous)) * 100)));
}
