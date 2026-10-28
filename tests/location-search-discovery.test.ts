import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("geographic discovery filters every eligible candidate before limiting results", () => {
  const marketplace = read("lib/marketplace.ts");

  assert.match(marketplace, /const appliesGeographicFilter = Boolean\(searchOrigin && radiusMiles && options\.delivery !== "REMOTE"\)/);
  assert.match(marketplace, /const limitClause = appliesGeographicFilter \? ""/);
  assert.match(marketplace, /return nearbyServices\.slice\(0, requestedLimit\)/);
  assert.doesNotMatch(marketplace, /Math\.max\(requestedLimit, 200\)/);
});

test("public discovery applies authoritative listing and provider eligibility", () => {
  const marketplace = read("lib/marketplace.ts");

  assert.match(marketplace, /s\.is_active = true/);
  assert.match(marketplace, /s\.provider_deleted_at IS NULL/);
  assert.match(marketplace, /p\.is_active = true/);
  assert.match(marketplace, /p\.age_verification_status = 'verified'/);
  assert.match(marketplace, /company\.is_active = true/);
  assert.doesNotMatch(marketplace, /stripe_payouts_enabled/);
});

test("location discovery honors listing radius, explicit areas, and remote delivery", () => {
  const marketplace = read("lib/marketplace.ts");

  assert.match(marketplace, /distance <= radiusMiles && distance <= service\.serviceRadiusMiles/);
  assert.match(marketplace, /service\.serviceAreaCities\.includes/);
  assert.match(marketplace, /service\.deliveryType === "REMOTE"/);
  assert.match(marketplace, /service\.deliveryType === "BOTH" && options\.delivery !== "IN_PERSON"/);
});

test("location controls synchronize with client-side search navigation", () => {
  const locationFilter = read("components/location-filter.tsx");

  assert.match(locationFilter, /setLocation\(initialLocation\)/);
  assert.match(locationFilter, /setRadius\(initialRadius\)/);
  assert.match(locationFilter, /\[initialLocation, initialRadius\]/);
});
