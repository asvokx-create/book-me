export type ComplimentaryProDuration = "30_days" | "3_months" | "6_months" | "1_year" | "lifetime" | "custom";

export function isComplimentaryProDuration(value: unknown): value is ComplimentaryProDuration {
  return value === "30_days" || value === "3_months" || value === "6_months"
    || value === "1_year" || value === "lifetime" || value === "custom";
}

function addUtcMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function complimentaryProExpiration(input: {
  duration: ComplimentaryProDuration;
  startsAt: Date;
  customDays?: number;
}) {
  const start = new Date(input.startsAt);
  if (!Number.isFinite(start.getTime())) throw new RangeError("Choose a valid grant start date.");
  if (input.duration === "lifetime") return null;
  if (input.duration === "30_days") return new Date(start.getTime() + 30 * 86_400_000);
  if (input.duration === "3_months") return addUtcMonths(start, 3);
  if (input.duration === "6_months") return addUtcMonths(start, 6);
  if (input.duration === "1_year") return addUtcMonths(start, 12);
  if (!Number.isInteger(input.customDays) || input.customDays! < 1 || input.customDays! > 3_650) {
    throw new RangeError("Custom complimentary access must be between 1 and 3,650 days.");
  }
  return new Date(start.getTime() + input.customDays! * 86_400_000);
}

export function isComplimentaryProActive(input: { startsAt: Date; expiresAt: Date | null; revokedAt: Date | null }, now = new Date()) {
  return !input.revokedAt && input.startsAt <= now && (input.expiresAt === null || input.expiresAt > now);
}

export function paidSubscriptionProvidesPro(input: {
  subscriptionId: string | null;
  status: string;
  billingMode: string | null;
}, currentMode: string) {
  return Boolean(input.subscriptionId)
    && input.billingMode === currentMode
    && (input.status === "active" || input.status === "trialing" || input.status === "past_due");
}
