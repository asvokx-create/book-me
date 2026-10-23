import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateAffiliateAgreementConsent } from "../lib/affiliate-agreement-consent.ts";
import { AFFILIATE_LEGAL_DOCUMENT_LIST } from "../lib/legal-document-versions.ts";

test("affiliate application requires all three separate affirmative acknowledgments", () => {
  assert.deepEqual(validateAffiliateAgreementConsent({}).missing, ["Partner Agreement", "Terms of Service", "Privacy Policy"]);
  assert.equal(validateAffiliateAgreementConsent({ partnerAgreementAccepted: true, termsAccepted: true }).accepted, false);
  assert.equal(validateAffiliateAgreementConsent({ partnerAgreementAccepted: true, termsAccepted: true, privacyAcknowledged: true }).accepted, true);
  assert.equal(validateAffiliateAgreementConsent({ partnerAgreementAccepted: "true", termsAccepted: "true", privacyAcknowledged: "true" }).accepted, true);
  assert.equal(validateAffiliateAgreementConsent({ partnerAgreementAccepted: "on", termsAccepted: true, privacyAcknowledged: true }).accepted, false);
});

test("published legal source hashes match the immutable version manifest", async () => {
  for (const document of AFFILIATE_LEGAL_DOCUMENT_LIST) {
    const bytes = await readFile(new URL(`../${document.sourcePath}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), document.contentHash, `${document.key} source changed without a new hash`);
  }
});

test("application records agreement evidence atomically and blocks direct API bypass", async () => {
  const route = await readFile(new URL("../app/api/affiliates/apply/route.ts", import.meta.url), "utf8");
  assert.match(route, /validateAffiliateAgreementConsent\(body\)/);
  assert.match(route, /await client\.query\("BEGIN"\)/);
  assert.match(route, /affiliate_agreement_acceptances/);
  assert.match(route, /affiliate_application/);
  assert.match(route, /await client\.query\("COMMIT"\)/);
  assert.match(route, /await client\.query\("ROLLBACK"\)/);
  assert.match(route, /customPartnershipRequested/);
  assert.doesNotMatch(route, /UPDATE affiliate_(?:commissions|referrals)/);
});

test("acceptance history is append-only and legacy partners are not backfilled", async () => {
  const migration = await readFile(new URL("../database/migrations/102_affiliate_agreement_acceptance_history.sql", import.meta.url), "utf8");
  assert.match(migration, /BEFORE UPDATE OR DELETE ON affiliate_agreement_acceptances/);
  assert.match(migration, /Existing profiles are deliberately left unchanged/);
  assert.doesNotMatch(migration, /UPDATE affiliate_profiles SET/);
  assert.doesNotMatch(migration, /affiliate_commissions|affiliate_referrals/);
});

test("version-aware reacceptance requires authentication and preserves compensation", async () => {
  const route = await readFile(new URL("../app/api/affiliates/agreements/route.ts", import.meta.url), "utf8");
  assert.match(route, /auth\.api\.getSession/);
  assert.match(route, /WHERE user_id=\$1/);
  assert.match(route, /validateAffiliateAgreementConsent/);
  assert.match(route, /affiliate_reacceptance/);
  assert.match(route, /agreement_reacceptance_required_at=NULL/);
  assert.doesNotMatch(route, /compensation|commission|revenue_share|custom_campaign/);
});

test("admin acceptance history stays behind existing server-side admin authorization", async () => {
  const [route, admin] = await Promise.all([
    readFile(new URL("../app/api/admin/affiliates/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/affiliate-admin.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /const session = await getAdminSession\(\)/);
  assert.match(route, /Admin access required/);
  assert.match(route, /FROM affiliate_agreement_acceptances/);
  assert.match(admin, /Agreement acceptance history/);
  assert.match(admin, /No append-only acceptance record is available/);
});
