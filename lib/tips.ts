export const TIP_PERCENTAGES = [10, 15, 20] as const;
export const MINIMUM_TIP_CENTS = 50;
export const ABSOLUTE_MAXIMUM_TIP_CENTS = 100_000;
export const MAXIMUM_TIP_BASIS_POINTS = 10_000;
export const HIGH_TIP_CONFIRMATION_BASIS_POINTS = 5_000;

export type TipSelection =
  | { type: "percentage"; percentage: (typeof TIP_PERCENTAGES)[number]; amountCents: number }
  | { type: "custom"; percentage: null; amountCents: number };

function requireCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer number of cents.`);
}

export function maximumTipCents(serviceSubtotalCents: number) {
  requireCents(serviceSubtotalCents, "Service subtotal");
  return Math.min(ABSOLUTE_MAXIMUM_TIP_CENTS, Math.floor(serviceSubtotalCents * MAXIMUM_TIP_BASIS_POINTS / 10_000));
}

export function requiresHighTipConfirmation(amountCents: number, serviceSubtotalCents: number) {
  requireCents(amountCents, "Tip amount");
  requireCents(serviceSubtotalCents, "Service subtotal");
  return amountCents * 10_000 > serviceSubtotalCents * HIGH_TIP_CONFIRMATION_BASIS_POINTS;
}

export function resolveTipSelection(input: {
  type: unknown;
  percentage?: unknown;
  amountCents?: unknown;
  serviceSubtotalCents: number;
  highTipConfirmed?: unknown;
}): TipSelection {
  requireCents(input.serviceSubtotalCents, "Service subtotal");
  if (input.serviceSubtotalCents < MINIMUM_TIP_CENTS) throw new RangeError("This completed service is not eligible for a tip.");

  const type = input.type;
  const percentage = Number(input.percentage);
  const customAmount = Number(input.amountCents);
  const selection: TipSelection = type === "percentage" && TIP_PERCENTAGES.includes(percentage as (typeof TIP_PERCENTAGES)[number])
    ? { type: "percentage", percentage: percentage as (typeof TIP_PERCENTAGES)[number], amountCents: Math.round(input.serviceSubtotalCents * percentage / 100) }
    : type === "custom" && Number.isSafeInteger(customAmount)
      ? { type: "custom", percentage: null, amountCents: customAmount }
      : (() => { throw new RangeError("Choose a valid tip amount."); })();

  const maximum = maximumTipCents(input.serviceSubtotalCents);
  if (selection.amountCents < MINIMUM_TIP_CENTS) throw new RangeError(`Tips must be at least $${(MINIMUM_TIP_CENTS / 100).toFixed(2)}.`);
  if (selection.amountCents > maximum) throw new RangeError(`Tips cannot exceed $${(maximum / 100).toFixed(2)} for this booking.`);
  if (requiresHighTipConfirmation(selection.amountCents, input.serviceSubtotalCents) && input.highTipConfirmed !== true)
    throw new RangeError("Confirm this unusually large tip before continuing.");
  return selection;
}
