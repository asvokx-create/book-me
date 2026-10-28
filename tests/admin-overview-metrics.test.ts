import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every admin overview metric opens an accessible detail dialog", async () => {
  const dashboard = await read("components/admin-dashboard.tsx");

  for (const label of ["Total accounts", "Active providers", "Active listings", "Unique visitors", "Referral clicks", "Bookings", "Open reports", "Safety blocks"]) {
    assert.match(dashboard, new RegExp(`label: "${label}"`));
  }
  assert.match(dashboard, /aria-label={`View details for \$\{stat\.label\}`}/);
  assert.match(dashboard, /setSelectedStatId\(stat\.id\)/);
  assert.match(dashboard, /role="dialog" aria-modal="true" aria-labelledby="admin-stat-detail-title"/);
  assert.match(dashboard, /Time range/);
  assert.match(dashboard, /How it is counted/);
  assert.match(dashboard, /destinationSection/);
  assert.match(dashboard, /destinationHref/);
});

test("active providers opens a provider-only account view", async () => {
  const dashboard = await read("components/admin-dashboard.tsx");

  assert.match(dashboard, /accountScope === "active_providers" && \(!account\.provider_id \|\| account\.provider_active !== true\)/);
  assert.match(dashboard, /selectedStat\.id === "providers" \? "active_providers" : "all"/);
  assert.match(dashboard, /Showing active providers only/);
  assert.match(dashboard, /Show all accounts/);
});

test("admin metric explanations match the server-side definitions", async () => {
  const [dashboard, route] = await Promise.all([
    read("components/admin-dashboard.tsx"),
    read("app/api/admin/route.ts"),
  ]);

  assert.match(route, /FROM bookings WHERE created_at >= now\(\) - interval '30 days'/);
  assert.match(dashboard, /Bookings created during the last 30 days, including every status/);
  assert.match(route, /status IN \('open', 'reviewing'\)/);
  assert.match(dashboard, /currently open or under review/);
  assert.match(route, /event\.path !~ '\^\/\(admin\|account\|affiliate\)/);
  assert.match(dashboard, /Private admin, account, affiliate, and provider dashboard pages are excluded/);
  assert.match(route, /FROM affiliate_click_events/);
  assert.match(dashboard, /Every qualifying visit through an active Partner referral link/);
});
