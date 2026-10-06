import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("admin overview reports all-time unique public site visitors", () => {
  const route = read("app", "api", "admin", "route.ts");
  const dashboard = read("components", "admin-dashboard.tsx");
  const migration = read("database", "migrations", "078_unique_site_views.sql");

  assert.match(route, /count\(DISTINCT COALESCE\(NULLIF\(event\.user_id, ''\), known_visitor\.user_id, NULLIF\(event\.anonymous_id, ''\)\)\)::int/);
  assert.match(route, /FROM analytics_events event/);
  assert.match(route, /GROUP BY anonymous_id/);
  assert.match(route, /event\.event_name = 'page_view'/);
  assert.match(route, /event\.path !~ '\^\/\(admin\|account\|affiliate\)/);
  assert.match(route, /AS unique_site_views/);
  assert.match(dashboard, /label: "Site views", value: data\.stats\.unique_site_views/);
  assert.match(dashboard, /Unique visitors · all time/);
  assert.match(migration, /analytics_events_page_view_visitor_idx/);
});
