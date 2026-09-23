import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { accountLocationSourceLabel, normalizeAccountLocation } from "../lib/account-location.ts";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("general account locations normalize and validate U.S. values", () => {
  assert.deepEqual(normalizeAccountLocation({ city: "  Issaquah ", state: "wa", postalCode: "98027", country: "USA" }).location, {
    city: "Issaquah", state: "WA", postalCode: "98027", country: "United States",
  });
  assert.equal(normalizeAccountLocation({ city: "Seattle", state: "WA", postalCode: "98101 1234" }).location?.postalCode, "98101-1234");
  assert.match(normalizeAccountLocation({ city: "Seattle", state: "ZZ", postalCode: "98101" }).error ?? "", /valid U.S. state/);
  assert.match(normalizeAccountLocation({ city: "Seattle", state: "WA", postalCode: "981" }).error ?? "", /ZIP/);
  assert.equal(accountLocationSourceLabel("BROWSER_LOCATION_CONFIRMED"), "Browser location confirmed");
});

test("signup requires a general location and discloses why it is collected", () => {
  const form = read("app/auth-form.tsx");
  assert.match(form, /autoComplete="address-level2"/);
  assert.match(form, /autoComplete="address-level1"/);
  assert.match(form, /autoComplete="postal-code"/);
  assert.match(form, /city: normalizedLocation!\.location!\.city/);
  assert.match(form, /Terms of Service/);
  assert.match(form, /Privacy Policy/);
});

test("account settings store only confirmed general location values", () => {
  const route = read("app/api/account/settings/route.ts");
  assert.match(route, /normalizeAccountLocation/);
  assert.match(route, /account_location_updated/);
  assert.doesNotMatch(route, /latitude|longitude|\blat\b|\blng\b/);
  const form = read("app/account/settings/settings-form.tsx");
  assert.match(form, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(form, /BROWSER_LOCATION_CONFIRMED/);
  assert.match(form, /Confirm the city and state/);
});

test("marketplace explicit searches take priority over the account default", () => {
  const source = read("lib/request-location.ts");
  assert.ok(source.indexOf("explicitLocation?.trim()") < source.indexOf("auth.api.getSession"));
  assert.ok(source.indexOf("location_city AS city") < source.indexOf("x-vercel-ip-city"));
});

test("account location remains separate from provider and booking locations", () => {
  const migration = read("database/migrations/057_account_general_location.sql");
  assert.match(migration, /location_city/);
  assert.doesNotMatch(migration, /latitude|longitude|service_address|booking/);
  const admin = read("components/admin-dashboard.tsx");
  assert.match(admin, /General account location/);
  assert.match(admin, /Provider profile, service area, and billing/);
});
