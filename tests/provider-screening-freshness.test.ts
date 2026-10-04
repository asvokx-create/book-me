import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { isProviderScreeningCurrent, PROVIDER_SCREENING_MAX_AGE_DAYS } from "../lib/provider-screening-freshness.ts";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");
const now = new Date("2026-10-03T12:00:00.000Z");

test("provider screening expires after the documented freshness window", () => {
  assert.equal(PROVIDER_SCREENING_MAX_AGE_DAYS, 30);
  assert.equal(isProviderScreeningCurrent(new Date("2026-10-03T12:00:00.000Z"), now), true);
  assert.equal(isProviderScreeningCurrent(new Date("2026-09-03T12:00:00.000Z"), now), true);
  assert.equal(isProviderScreeningCurrent(new Date("2026-09-03T11:59:59.999Z"), now), false);
  assert.equal(isProviderScreeningCurrent(null, now), false);
  assert.equal(isProviderScreeningCurrent("not-a-date", now), false);
  assert.equal(isProviderScreeningCurrent(new Date("2026-10-04T12:00:00.000Z"), now), false);
});

test("every public provider trust badge is gated by screening freshness", () => {
  const marketplace = source("lib/marketplace.ts");
  const companies = source("lib/companies.ts");
  const companyPage = source("app/companies/[slug]/page.tsx");
  assert.match(marketplace, /screeningCurrent && row\.phone_verified/);
  assert.match(marketplace, /screeningCurrent && row\.identity_verified/);
  assert.match(marketplace, /screeningCurrent && row\.business_verified/);
  assert.match(marketplace, /screeningCurrent && row\.is_verified && row\.screening_status === "passed"/);
  assert.match(marketplace, /screeningCurrent && provider\.is_verified && provider\.screening_status === "passed"/);
  assert.match(companies, /isProviderScreeningCurrent\(company\.screening_checked_at\)/);
  assert.match(companies, /screeningCurrent && company\.is_verified && company\.screening_status === "passed"/);
  assert.match(companyPage, /✓ Profile screened/);
  assert.doesNotMatch(companyPage, /BubsBookings screened/);
});
