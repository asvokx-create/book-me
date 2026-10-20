export const affiliateAnalyticsRanges = ["7d", "30d", "90d", "all", "custom"] as const;

export type AffiliateAnalyticsRange = (typeof affiliateAnalyticsRanges)[number];

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type AffiliateAnalyticsWindow = {
  range: AffiliateAnalyticsRange;
  start: Date | null;
  end: Date | null;
  label: string;
  valid: boolean;
};

function utcDate(value: string) {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function affiliateAnalyticsWindow(input: {
  range?: string | null;
  start?: string | null;
  end?: string | null;
  now?: Date;
}): AffiliateAnalyticsWindow {
  const now = input.now ?? new Date();
  const requested = affiliateAnalyticsRanges.includes(input.range as AffiliateAnalyticsRange)
    ? input.range as AffiliateAnalyticsRange
    : "30d";

  if (requested === "all") return { range: "all", start: null, end: null, label: "All time", valid: true };
  if (requested !== "custom") {
    const days = Number(requested.slice(0, -1));
    return { range: requested, start: new Date(now.getTime() - days * DAY_MS), end: null, label: `Last ${days} days`, valid: true };
  }

  const start = utcDate(input.start ?? "");
  const inclusiveEnd = utcDate(input.end ?? "");
  if (!start || !inclusiveEnd || inclusiveEnd < start || inclusiveEnd.getTime() - start.getTime() > 365 * DAY_MS) {
    return { range: "custom", start: null, end: null, label: "Invalid custom range", valid: false };
  }
  const end = new Date(inclusiveEnd.getTime() + DAY_MS);
  return { range: "custom", start, end, label: `${input.start} to ${input.end}`, valid: true };
}

export function aggregateAffiliateClickTrends(rows: Array<{ period: string | Date; clicks: number }>) {
  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();
  for (const row of rows) {
    const date = new Date(row.period);
    const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const weekday = (date.getUTCDay() + 6) % 7;
    const week = new Date(day - weekday * DAY_MS).toISOString().slice(0, 10);
    const month = date.toISOString().slice(0, 7);
    weekly.set(week, (weekly.get(week) ?? 0) + Number(row.clicks));
    monthly.set(month, (monthly.get(month) ?? 0) + Number(row.clicks));
  }
  return {
    weekly: [...weekly].map(([period, clicks]) => ({ period, clicks })),
    monthly: [...monthly].map(([period, clicks]) => ({ period, clicks })),
  };
}
