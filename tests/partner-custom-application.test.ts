import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path: string) { return readFileSync(new URL(path, import.meta.url), "utf8"); }

test("custom partnership fields stay conditional and never expose compensation controls", () => {
  const form = source("../components/partner-application-form.tsx");
  assert.match(form, /customRequested && <div id="custom-partnership-fields"/);
  assert.match(form, /I&apos;d like to discuss a custom program/);
  assert.match(form, /customPartnershipTypes/);
  assert.match(form, /promotionTypes/);
  assert.match(form, /mediaKitUrl/);
  assert.doesNotMatch(form, /requestedRevenueShare|requestedActivationBonus|requestedFixedPayment|requestedMinimumPayout/);
});

test("custom request migration is additive and defaults existing applications to standard", () => {
  const migration = source("../database/migrations/071_partner_custom_requests.sql");
  assert.match(migration, /custom_partnership_requested boolean NOT NULL DEFAULT false/);
  assert.match(migration, /custom_partnership_types text\[\] NOT NULL DEFAULT ARRAY\[\]::text\[\]/);
  assert.match(migration, /active_platforms text\[\]/);
  assert.match(migration, /promotion_types text\[\]/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/);
});

test("application API validates allowlists, counts, URLs, content, and meaningful custom requests", () => {
  const route = source("../app/api/affiliates/apply/route.ts");
  assert.match(route, /allowed\.has\(value\)/);
  assert.match(route, /value >= 0 && value <= 2_000_000_000/);
  assert.match(route, /\["http:", "https:"\]/);
  assert.match(route, /scanContent/);
  assert.match(route, /requestedTypes\.length < 1/);
  assert.match(route, /activePlatforms\.length < 1 && requestedPromotions\.length < 1/);
});

test("standard and custom approvals both reuse the protected compensation system", () => {
  const admin = source("../components/affiliate-admin.tsx");
  const route = source("../app/api/admin/affiliates/route.ts");
  assert.match(admin, /Approve as Standard/);
  assert.match(admin, /Approve as Custom/);
  assert.match(admin, /compensationConfigured:false/);
  assert.match(admin, /compensationType:"custom"/);
  assert.match(route, /else if \(status === "approved"\)/);
  assert.match(route, /selectedProgram\.rows\[0\]/);
  assert.match(route, /syncCompensationCampaign/);
});

test("custom applications receive tailored email and visible admin notification", () => {
  const route = source("../app/api/affiliates/apply/route.ts");
  const admin = source("../components/affiliate-admin.tsx");
  assert.match(route, /Custom partnership request received/);
  assert.match(route, /Custom Partnership Requested/);
  assert.match(route, /INSERT INTO notifications/);
  assert.match(admin, /aria-label="Custom partnership request"/);
  assert.match(admin, /Media kit/);
  assert.match(admin, /Portfolio/);
});
