export const PROVIDER_SCREENING_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isProviderScreeningCurrent(
  checkedAt: Date | string | null | undefined,
  now: Date = new Date(),
) {
  if (!checkedAt) return false;
  const checkedTime = checkedAt instanceof Date ? checkedAt.getTime() : Date.parse(checkedAt);
  const ageMs = now.getTime() - checkedTime;
  return Number.isFinite(checkedTime) && ageMs >= 0 && ageMs <= PROVIDER_SCREENING_MAX_AGE_DAYS * DAY_MS;
}
