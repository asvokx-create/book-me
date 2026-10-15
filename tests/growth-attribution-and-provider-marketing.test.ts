import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("general UTM attribution is first-party, opaque, and separate from affiliate attribution", () => {
  const migration = read("database", "migrations", "086_growth_campaign_attribution.sql");
  const route = read("app", "api", "growth", "attribution", "route.ts");
  const tracker = read("components", "growth-attribution-tracker.tsx");
  assert.match(migration, /growth_campaign_attributions/);
  assert.match(route, /httpOnly: true/);
  assert.match(route, /utm_source/);
  assert.match(route, /attributed_user_id/);
  assert.match(tracker, /utm_campaign/);
});

test("provider marketing reuses real listing views and completed booking counts", () => {
  const api = read("app", "api", "providers", "me", "route.ts");
  const tools = read("components", "provider-marketing-tools.tsx");
  assert.match(api, /completed_booking_count/);
  assert.match(tools, /public views/);
  assert.match(tools, /completed bookings/);
});

test("social content uses real active listings and never auto-publishes", () => {
  const page = read("app", "admin", "growth", "content", "page.tsx");
  const studio = read("components", "admin-social-content-studio.tsx");
  assert.match(page, /service\.is_active=true/);
  assert.match(page, /getAdminSession\(\)/);
  assert.match(studio, /BubsBookings does not publish posts automatically/);
  assert.match(studio, /Editable social post/);
});
