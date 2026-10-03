import type { ProviderPlan } from "./plans";

export const INCLUDED_PRO_TEAM_SEATS = 3;
export const EXTRA_TEAM_SEAT_PRICE_CENTS = 50;
export const MAX_EXTRA_TEAM_SEATS = 97;

export function totalTeamSeats(plan: ProviderPlan, extraSeats: number) {
  if (plan === "owner" || plan === "business") return null;
  if (plan === "starter") return 1;
  return INCLUDED_PRO_TEAM_SEATS + Math.max(0, Math.trunc(extraSeats));
}

export function extraSeatMonthlyCents(extraSeats: number) {
  return Math.max(0, Math.trunc(extraSeats)) * EXTRA_TEAM_SEAT_PRICE_CENTS;
}

export function proMonthlyTotalCents(extraSeats: number) {
  return 999 + extraSeatMonthlyCents(extraSeats);
}

export function minimumExtraSeatsForWorkers(reservedWorkerCount: number) {
  // The provider owner uses one of the three included Pro seats. The other two
  // included seats are available to active workers or unaccepted invitations.
  return Math.max(0, Math.trunc(reservedWorkerCount) - (INCLUDED_PRO_TEAM_SEATS - 1));
}

export function subscriptionProvidesProAccess(status: string) {
  // Stripe retries past-due invoices. Keep the existing Pro grace behavior and
  // do not disable a provider's team while those retries are in progress.
  return status === "active" || status === "trialing" || status === "past_due";
}
