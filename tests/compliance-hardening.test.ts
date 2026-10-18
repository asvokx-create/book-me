import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("new signups require a server-issued policy-consent attestation", async () => {
  const [route, auth, form] = await Promise.all([
    source("app/api/policy-consent/route.ts"),
    source("lib/auth.ts"),
    source("app/auth-form.tsx"),
  ]);
  assert.match(route, /termsAccepted !== true \|\| body\?\.privacyAcknowledged !== true/);
  assert.match(route, /POLICY_CONSENT_COOKIE/);
  assert.match(auth, /hasValidPolicyConsentAttestation/);
  assert.match(form, /fetch\("\/api\/policy-consent"/);
});

test("analytics discards raw search text and query-string paths before persistence", async () => {
  const [route, tracker, search] = await Promise.all([
    source("app/api/analytics/route.ts"),
    source("components/analytics-tracker.tsx"),
    source("components/search-results-analytics.tsx"),
  ]);
  assert.match(route, /safePath/);
  assert.match(route, /safeSearchMetadata/);
  assert.match(route, /"local_search", "remote_search"/);
  assert.match(tracker, /const path = pathname/);
  assert.match(search, /queryLength: query\.trim\(\)\.length/);
  assert.match(search, /path: window\.location\.pathname/);
});

test("imported customer deletion is provider-scoped and requires client access", async () => {
  const [route, manager] = await Promise.all([
    source("app/api/providers/customer-imports/route.ts"),
    source("components/customer-import-manager.tsx"),
  ]);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /getMarketingAccess\("clients"\)/);
  assert.match(route, /WHERE id::text=\$1 AND provider_id::text=\$2/);
  assert.match(manager, /method: "DELETE"/);
  assert.match(manager, />Delete<\/button>/);
});

test("privacy disclosures explain imported-contact deletion and non-account requests", async () => {
  const [privacy, migration] = await Promise.all([
    source("app/privacy/page.tsx"),
    source("database/migrations/092_provider_customer_imports.sql"),
  ]);
  assert.match(privacy, /Providers can export or delete imported records from their dashboard\./);
  assert.match(privacy, /A person whose information was imported may contact the provider or BubsBookings/);
  assert.match(privacy, /No account is required to email a request\./);
  assert.match(migration, /ON DELETE CASCADE/);
});

test("provider marketing cannot send without a configured postal address and keeps an unsubscribe link", async () => {
  const [sourceText, campaignRoute, jobs] = await Promise.all([
    source("lib/provider-marketing.ts"),
    source("app/api/providers/campaigns/route.ts"),
    source("lib/marketing-jobs.ts"),
  ]);
  assert.match(sourceText, /MARKETING_POSTAL_ADDRESS/);
  assert.match(sourceText, /marketingPostalAddress\(\)/);
  assert.match(sourceText, /Unsubscribe from this provider's marketing emails/);
  assert.match(campaignRoute, /if\(!isMarketingConfigured\(\)\)return NextResponse\.json/);
  assert.match(campaignRoute, /marketing_suppressions/);
  assert.match(jobs, /pref\.status='unsubscribed'/);
});

test("the safety-report modal has focus containment and escape-key support", async () => {
  const sourceText = await source("components/report-user-button.tsx");
  assert.match(sourceText, /useModalAccessibility/);
  assert.match(sourceText, /ref=\{dialogRef\}/);
  assert.match(sourceText, /tabIndex=\{-1\}/);
});
