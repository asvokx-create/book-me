import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("Starter has a two-service limit", () => {
  const plans = read("lib", "plans.ts");
  assert.match(plans, /starter:[\s\S]*?serviceLimit:\s*2/);
});

test("listing limits use the provider's current server-side entitlement", () => {
  const limits = read("lib", "provider-listing-limits.ts");
  assert.match(limits, /complimentary_pro_grants/);
  assert.match(limits, /stripe_subscription_status IN \('active', 'trialing', 'past_due'\)/);
  assert.match(limits, /provider\.stripe_billing_mode = \$2/);
  assert.match(limits, /FOR UPDATE OF provider/);
});

test("current-listing slots exclude deleted and archived records but include age-verification-pending records", () => {
  const limits = read("lib", "provider-listing-limits.ts");
  assert.match(limits, /service\.provider_deleted_at IS NULL AND \(service\.is_active = true OR service\.age_verification_blocked = true\)/);
});

test("new listing creation and admin restoration enforce the same atomic plan limit", () => {
  const onboarding = read("app", "api", "providers", "onboarding", "route.ts");
  const admin = read("app", "api", "admin", "route.ts");
  assert.match(onboarding, /lockProviderListingLimit\(client, providerId\)/);
  assert.match(onboarding, /listingLimitExceeded\(listingLimit\.listingCount, listingLimit\.serviceLimit\)/);
  assert.ok(onboarding.indexOf("lockProviderListingLimit") < onboarding.indexOf("INSERT INTO services"));
  assert.match(admin, /lockProviderListingLimit\(client, target\.provider_id\)/);
  assert.match(admin, /Resolve the plan limit before restoring this listing/);
});

test("soft-deleted services cannot leak into public pages or transactional entry points", () => {
  const sources = [
    read("lib", "companies.ts"),
    read("lib", "marketplace.ts"),
    read("app", "api", "services", "[serviceId]", "availability", "route.ts"),
    read("app", "api", "bookings", "route.ts"),
    read("app", "api", "favorites", "[serviceId]", "route.ts"),
    read("app", "api", "messages", "route.ts"),
  ];
  for (const source of sources) assert.match(source, /provider_deleted_at IS NULL/);
});

test("admin accounts identify effective-plan listing-limit exceptions without changing provider data", () => {
  const admin = read("app", "api", "admin", "route.ts");
  const dashboard = read("components", "admin-dashboard.tsx");
  assert.match(admin, /provider_over_listing_limit/);
  assert.match(admin, /provider_current_listing_count/);
  assert.match(dashboard, /Listing limit review/);
});
