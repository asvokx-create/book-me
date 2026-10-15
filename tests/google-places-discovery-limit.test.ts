import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("provider discovery has a database-backed monthly Google Places request cap", () => {
  const migration = read("database", "migrations", "087_google_places_usage_limits.sql");
  const usage = read("lib", "google-places-usage.ts");
  const route = read("app", "api", "admin", "growth", "outreach", "route.ts");
  const ui = read("components", "admin-provider-outreach.tsx");
  const requestSecurity = read("lib", "request-security.ts");

  assert.match(migration, /google_places_usage_months/);
  assert.match(usage, /GOOGLE_PLACES_TEXT_SEARCH_PRO_MONTHLY_LIMIT = 4_999/);
  assert.match(usage, /WHERE google_places_usage_months\.request_count < \$2/);
  assert.match(usage, /allowed: false, usage: await getGooglePlacesTextSearchUsage\(\)/);
  assert.match(usage, /America\/Los_Angeles/);
  assert.match(route, /reserveGooglePlacesTextSearchRequest\(\)/);
  assert.match(route, /places:searchText/);
  assert.match(route, /AbortSignal\.timeout\(12_000\)/);
  assert.match(route, /GOOGLE_MAPS_PLACES_API_KEY/);
  assert.match(route, /monthly provider-discovery limit has been reached/i);
  assert.match(route, /Provider discovery audit logging failed/);
  assert.match(route, /Provider discovery budget check failed/);
  assert.doesNotMatch(route, /enforceRateLimit/);
  assert.match(ui, /Provider discovery could not reach BubsBookings/);
  assert.match(ui, /Provider discovery timed out before Google responded/);
  assert.match(ui, /request \$\{response\.status\}/);
  assert.match(requestSecurity, /to_timestamp\(\(floor\(extract\(epoch FROM now\(\)\) \/ \$3::double precision\) \* \$3::double precision\)\)/);
});
