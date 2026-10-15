import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("the growth dashboard is admin-only and uses first-party, privacy-conscious sources", () => {
  const page = read("app", "admin", "growth", "page.tsx");

  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /redirect\("\/login\?redirect=\/admin\/growth"\)/);
  assert.match(page, /analytics_events/);
  assert.match(page, /affiliate_clicks/);
  assert.match(page, /bookings/);
  assert.match(page, /first-party, consented BubsBookings activity/);
  assert.match(page, /does not access or expose Privatus credentials/);
});

test("the admin console exposes the growth dashboard at desktop and tablet widths", () => {
  const dashboard = read("components", "admin-dashboard.tsx");
  assert.match(dashboard, /href="\/admin\/growth"[^>]*>Growth<\/Link>/);
  assert.match(dashboard, /href="\/admin\/growth"[^>]*>Growth dashboard<\/Link>/);
});
