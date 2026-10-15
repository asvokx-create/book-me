import "server-only";

import { database } from "@/lib/database";

// Contact fields (public phone and website) use Google Places Text Search
// Enterprise. Keep this one request below its current 1,000-request monthly
// free allowance. This is a local safety guard, not a statement about the
// Google Cloud billing account or requests made elsewhere.
export const GOOGLE_PLACES_TEXT_SEARCH_ENTERPRISE_MONTHLY_LIMIT = 999;
// Retain the existing ledger key so prior discovery searches still count
// against the safer Enterprise cap, and the original database constraint
// continues to protect production before this release's migration runs.
const REQUEST_TYPE = "text_search_pro";

export type GooglePlacesUsage = {
  month: string;
  limit: number;
  used: number;
  remaining: number;
};

type UsageRow = { request_month: string; request_count: number };

function currentMonthLabel(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function usageFromRow(row?: UsageRow): GooglePlacesUsage {
  const used = row?.request_count ?? 0;
  return {
    // The database selects the month in BubsBookings' operating time zone.
    month: row?.request_month?.slice(0, 7) ?? currentMonthLabel(),
    limit: GOOGLE_PLACES_TEXT_SEARCH_ENTERPRISE_MONTHLY_LIMIT,
    used,
    remaining: Math.max(0, GOOGLE_PLACES_TEXT_SEARCH_ENTERPRISE_MONTHLY_LIMIT - used),
  };
}

const currentMonthSql = "date_trunc('month', now() AT TIME ZONE 'America/Los_Angeles')::date";

export async function getGooglePlacesTextSearchUsage(): Promise<GooglePlacesUsage> {
  const result = await database.query<UsageRow>(
    `SELECT request_month::text, request_count
     FROM google_places_usage_months
     WHERE request_month=${currentMonthSql} AND request_type=$1`,
    [REQUEST_TYPE],
  );
  return usageFromRow(result.rows[0]);
}

/**
 * Atomically reserve one Google Places Text Search Enterprise request. Every caller
 * must call this before sending a request to Google. The WHERE clause makes
 * the cap safe across concurrent server instances and browser sessions.
 */
export async function reserveGooglePlacesTextSearchRequest(): Promise<{ allowed: boolean; usage: GooglePlacesUsage }> {
  const result = await database.query<UsageRow>(
    `INSERT INTO google_places_usage_months(request_month, request_type, request_count)
     VALUES (${currentMonthSql}, $1, 1)
     ON CONFLICT (request_month, request_type) DO UPDATE
       SET request_count=google_places_usage_months.request_count+1, updated_at=now()
       WHERE google_places_usage_months.request_count < $2
     RETURNING request_month::text, request_count`,
    [REQUEST_TYPE, GOOGLE_PLACES_TEXT_SEARCH_ENTERPRISE_MONTHLY_LIMIT],
  );
  if (result.rows[0]) return { allowed: true, usage: usageFromRow(result.rows[0]) };
  return { allowed: false, usage: await getGooglePlacesTextSearchUsage() };
}
