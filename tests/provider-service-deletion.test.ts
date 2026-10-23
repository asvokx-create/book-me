import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("providers can archive current listings and remove archived listings from their dashboard", () => {
  const dashboard = read("components", "provider-dashboard.tsx");

  assert.match(dashboard, /setServicePendingDeletion\(service\)/);
  assert.match(dashboard, /Delete listing/);
  assert.match(dashboard, /Archived listings/);
  assert.match(dashboard, /Delete from archive/);
  assert.match(dashboard, /provider\.archivedServices/);
  assert.match(dashboard, /Delete this listing\?/);
  assert.match(dashboard, /method: "DELETE"/);
  assert.match(dashboard, /removed from your archived listings/);
  assert.match(dashboard, /createPortal\(/);
});

test("the listing deletion endpoint preserves records while enforcing ownership and two-stage removal", () => {
  const route = read("app", "api", "providers", "services", "[serviceId]", "route.ts");
  const migration = read("database", "migrations", "101_provider_archived_listings.sql");

  assert.match(route, /p\.user_id = \$2/);
  assert.match(route, /s\.provider_deleted_at IS NULL/);
  assert.match(route, /UPDATE services SET is_active=false, age_verification_blocked=false/);
  assert.match(route, /UPDATE services SET provider_deleted_at=now\(\)/);
  assert.match(route, /WHERE id::text = \$1/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz/);
});
