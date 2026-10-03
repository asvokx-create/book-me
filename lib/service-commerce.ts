export const RECURRENCE_OPTIONS = ["one_time", "weekly", "biweekly", "monthly"] as const;
export type RecurrenceOption = (typeof RECURRENCE_OPTIONS)[number];

export type ServicePackage = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  deliveryDays: number | null;
  revisionCount: number | null;
  features: string[];
};

export type ServiceAddOn = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  additionalMinutes: number;
  allowsQuantity: boolean;
  maxQuantity: number;
};

export type CouponRule = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumSubtotalCents: number;
  firstBookingOnly: boolean;
  repeatCustomerOnly: boolean;
  expiresAt: Date | null;
  usageLimit: number | null;
  redemptionCount: number;
};

export type SelectedAddOn = ServiceAddOn & { quantity: number; lineTotalCents: number };

function cents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer number of cents.`);
}

export function isRecurrenceOption(value: unknown): value is RecurrenceOption {
  return typeof value === "string" && RECURRENCE_OPTIONS.includes(value as RecurrenceOption);
}

export function recurrenceLabel(value: RecurrenceOption) {
  return value === "weekly" ? "Weekly" : value === "biweekly" ? "Every 2 weeks" : value === "monthly" ? "Monthly" : "One time";
}

export function nextOccurrence(start: Date, recurrence: Exclude<RecurrenceOption, "one_time">, count = 1) {
  const next = new Date(start);
  if (!Number.isInteger(count) || count < 1) throw new RangeError("Occurrence count must be a positive integer.");
  if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7 * count);
  else if (recurrence === "biweekly") next.setUTCDate(next.getUTCDate() + 14 * count);
  else {
    const originalDay = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(originalDay, lastDay));
  }
  return next;
}

export function calculateCommerceSelection(input: {
  servicePriceCents: number;
  selectedPackage?: ServicePackage | null;
  addOns: Array<{ addOn: ServiceAddOn; quantity: number }>;
  coupon?: CouponRule | null;
}) {
  cents(input.servicePriceCents, "Service price");
  const basePriceCents = input.selectedPackage?.priceCents ?? input.servicePriceCents;
  cents(basePriceCents, "Base price");
  const selectedAddOns: SelectedAddOn[] = input.addOns.map(({ addOn, quantity }) => {
    const normalizedQuantity = addOn.allowsQuantity ? quantity : 1;
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1 || normalizedQuantity > addOn.maxQuantity) throw new RangeError(`Choose a valid quantity for ${addOn.name}.`);
    cents(addOn.priceCents, "Add-on price");
    return { ...addOn, quantity: normalizedQuantity, lineTotalCents: addOn.priceCents * normalizedQuantity };
  });
  const addOnTotalCents = selectedAddOns.reduce((total, item) => total + item.lineTotalCents, 0);
  const originalSubtotalCents = basePriceCents + addOnTotalCents;
  let discountCents = 0;
  if (input.coupon) {
    if (originalSubtotalCents < input.coupon.minimumSubtotalCents) throw new RangeError("This booking does not meet the coupon minimum.");
    if (input.coupon.expiresAt && input.coupon.expiresAt.getTime() <= Date.now()) throw new RangeError("This coupon has expired.");
    if (input.coupon.usageLimit !== null && input.coupon.redemptionCount >= input.coupon.usageLimit) throw new RangeError("This coupon has reached its usage limit.");
    discountCents = input.coupon.discountType === "percentage"
      ? Math.round(originalSubtotalCents * Math.min(input.coupon.discountValue, 100) / 100)
      : Math.min(originalSubtotalCents, input.coupon.discountValue);
  }
  return {
    basePriceCents,
    addOnTotalCents,
    originalSubtotalCents,
    discountCents,
    serviceSubtotalCents: Math.max(0, originalSubtotalCents - discountCents),
    selectedAddOns,
  };
}

