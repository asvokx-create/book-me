import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("providers can delete current or archived listings from every listing dashboard", () => {
  const dashboard = read("components", "provider-dashboard.tsx");

  assert.match(dashboard, /setServicePendingDeletion\(service\)/);
  assert.match(dashboard, /Delete listing/);
  assert.match(dashboard, /Archived listings/);
  assert.match(dashboard, /Delete from archive/);
  assert.match(dashboard, /provider\.archivedServices/);
  assert.match(dashboard, /Delete this listing\?/);
  assert.match(dashboard, /method: "DELETE"/);
  assert.match(dashboard, /deleted and removed from all listing dashboards/);
  assert.match(dashboard, /createPortal\(/);
});

test("the listing deletion endpoint preserves records while hiding deleted listings everywhere", () => {
  const route = read("app", "api", "providers", "services", "[serviceId]", "route.ts");
  const providerRoute = read("app", "api", "providers", "me", "route.ts");
  const adminRoute = read("app", "api", "admin", "route.ts");
  const adminAccountRoute = read("app", "api", "admin", "accounts", "[userId]", "route.ts");
  const adminListingPage = read("app", "admin", "listings", "[serviceId]", "page.tsx");
  const migration = read("database", "migrations", "101_provider_archived_listings.sql");

  assert.match(route, /p\.user_id = \$2/);
  assert.match(route, /s\.provider_deleted_at IS NULL/);
  assert.match(route, /UPDATE services SET is_active=false, age_verification_blocked=false, provider_deleted_at=now\(\)/);
  assert.match(route, /WHERE id::text = \$1/);
  assert.match(providerRoute, /s\.provider_deleted_at IS NULL/);
  assert.match(adminRoute, /WHERE s\.provider_deleted_at IS NULL/);
  assert.match(adminAccountRoute, /provider_deleted_at IS NULL/);
  assert.match(adminListingPage, /s\.provider_deleted_at IS NULL/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz/);
});
