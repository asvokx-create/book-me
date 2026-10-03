import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path: string) { return readFileSync(new URL(path, import.meta.url), "utf8"); }

test("Partner applications require the signed-in account and use its identity", () => {
  const page = source("../app/partners/page.tsx");
  const form = source("../components/partner-application-form.tsx");
  const route = source("../app/api/affiliates/apply/route.ts");
  assert.match(page, /Sign in before you apply/);
  assert.match(page, /\/login\?redirect=/);
  assert.match(page, /\/signup\?redirect=/);
  assert.match(form, /Applying as/);
  assert.doesNotMatch(form, /name="email"|name="name"/);
  assert.match(route, /auth\.api\.getSession/);
  assert.match(route, /WHERE id=\$1 LIMIT 1/);
  assert.match(route, /const name = account\.name/);
  assert.match(route, /const email = account\.email/);
  assert.match(route, /INSERT INTO affiliate_profiles \(user_id,account_link_status,account_linked_at/);
});

test("verification redirect preserves the Partner application destination", () => {
  const form = source("../app/auth-form.tsx");
  const checkEmail = source("../app/check-email/page.tsx");
  assert.match(form, /\/check-email\?redirect=/);
  assert.match(checkEmail, /redirectTo/);
  assert.match(checkEmail, /continue to the page you originally requested/);
});

test("Partner surfaces and payouts are owned strictly by user id", () => {
  const dashboard = source("../app/affiliate/page.tsx");
  const navigation = source("../app/api/account/navigation/route.ts");
  const connect = source("../app/api/affiliates/stripe/connect/route.ts");
  const status = source("../app/api/affiliates/stripe/status/route.ts");
  const attribution = source("../lib/affiliates.ts");
  for (const protectedSource of [dashboard, navigation, connect, status]) {
    assert.match(protectedSource, /user_id\s*=\s*\$1/);
    assert.doesNotMatch(protectedSource, /lower\(email\)|lower\(affiliate\.email\)/);
  }
  assert.match(attribution, /affiliate\.user_id = referred_owner\.id/);
  assert.doesNotMatch(attribution, /affiliate\.email\) = lower\(referred_owner\.email/);
});

test("historical applications are audited and only exact verified matches auto-link", () => {
  const migration = source("../database/migrations/072_partner_account_ownership.sql");
  const helper = source("../lib/affiliate-account.ts");
  assert.match(migration, /account_link_status IN \('linked','setup_required','manual_review'\)/);
  assert.match(migration, /account\."emailVerified" = true/);
  assert.match(migration, /match\.match_count = 1/);
  assert.match(migration, /CREATE OR REPLACE VIEW affiliate_account_link_audit/);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/);
  assert.match(helper, /candidates\.rows\.length !== 1/);
  assert.match(helper, /NOT EXISTS \(SELECT 1 FROM affiliate_profiles existing WHERE existing\.user_id=\$1\)/);
});

test("admin review shows account proof and blocks approval without ownership", () => {
  const admin = source("../components/affiliate-admin.tsx");
  const route = source("../app/api/admin/affiliates/route.ts");
  assert.match(admin, /Linked BubsBookings account/);
  assert.match(admin, /Account setup required/);
  assert.match(admin, /Link verified account/);
  assert.match(admin, /busy===item\.id\|\|!item\.user_id/);
  assert.match(route, /action === "affiliate_link_account"/);
  assert.match(route, /throw new Error\("ACCOUNT_REQUIRED"\)/);
  assert.match(route, /Your BubsBookings Partner application was approved/);
  assert.match(route, /account you used to apply/);
});

test("existing application states replace the form with status-aware guidance", () => {
  const page = source("../app/partners/page.tsx");
  assert.match(page, /Your application is under review/);
  assert.match(page, /Your Partner account is ready/);
  assert.match(page, /Your Partner account is suspended/);
  assert.match(page, /Go to Partner Dashboard/);
  assert.match(page, /View my Partner terms/);
});
