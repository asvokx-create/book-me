import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const publicPolicyPages = [
  "terms",
  "privacy",
  "provider-agreement",
  "partner-agreement",
  "cookies",
  "ai-transparency",
  "accessibility",
  "content-removal",
  "promise",
];

test("public policy pages never expose internal drafting labels", async () => {
  const forbiddenDraftingLabels = /LEGAL REVIEW REQUIRED|TODO LEGAL|ATTORNEY REVIEW|DRAFT ONLY|REVIEW BEFORE PRODUCTION|PLACEHOLDER LEGAL|NOT FINAL/i;
  const sources = await Promise.all(publicPolicyPages.map((page) => readFile(new URL(`../app/${page}/page.tsx`, import.meta.url), "utf8")));

  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, forbiddenDraftingLabels, `${publicPolicyPages[index]} contains a public internal drafting label`);
  }
});

test("legal pages disclose current affiliate funding, privacy, and analytics behavior", async () => {
  const [terms, privacy, partner, cookies, contentRemoval] = await Promise.all([
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partner-agreement/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cookies/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/content-removal/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(terms, /POLICY_EFFECTIVE_DATE/);
  assert.match(terms, /unpaid affiliate earnings as platform obligations/);
  assert.match(terms, /href="\/partner-agreement"/);
  assert.match(partner, /operational reserve calculation/);
  assert.match(partner, /not create an escrow, trust, deposit, custodial account/);
  assert.match(partner, /ftc\.gov\/business-guidance/);
  assert.match(partner, /Applicants must be at least 18/);
  assert.match(privacy, /detach the sign-in account while retaining the partner application/);
  assert.match(privacy, /does not include[\s\S]*every Stripe, affiliate, administrative/);
  assert.match(cookies, /<code>_ga<\/code>/);
  assert.match(cookies, /Optional browser analytics stays off unless you allow it/);
  assert.match(cookies, /account, booking, payment, refund, dispute, safety/);
  assert.match(cookies, /Cookie choices/);
  assert.match(privacy, /stay off unless you choose “Allow analytics.”/);
  assert.match(contentRemoval, /no later than 48 hours/);
  assert.match(contentRemoval, /copyright\.gov\/512/);
});

test("optional analytics is consent-gated without disabling necessary storage or affiliate attribution", async () => {
  const [consent, google, tracker, search, share, booking, layout, footer] = await Promise.all([
    readFile(new URL("../components/analytics-consent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/google-analytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/analytics-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/search-results-analytics.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/listing-share-button.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/booking-details.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/site-footer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(consent, /Continue without analytics/);
  assert.match(consent, /Allow analytics/);
  assert.match(consent, /removeItem\("bubs-analytics-id"\)/);
  assert.match(consent, /name === "_ga" \|\| name\?\.startsWith\("_ga_"\)/);
  assert.match(consent, /Necessary sign-in, security, preferences, referral attribution, and account or transaction records are not changed/);
  assert.match(google, /consent !== "granted"/);
  assert.match(tracker, /consent !== "granted"/);
  assert.match(search, /consent !== "granted"/);
  assert.match(share, /analyticsAllowed\(\)/);
  assert.match(booking, /analyticsAllowed\(\)/);
  assert.match(layout, /<AnalyticsConsentManager \/>/);
  assert.match(footer, /<AnalyticsChoicesButton/);
});

test("partner applications require and retain explicit agreement acceptance", async () => {
  const [form, route, migration] = await Promise.all([
    readFile(new URL("../components/partner-application-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/affiliates/apply/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/069_partner_application_consent.sql", import.meta.url), "utf8"),
  ]);
  assert.match(form, /name="partnerAgreementAccepted" type="checkbox" value="true" required/);
  assert.match(form, /I have reviewed and agree to the/);
  assert.match(route, /partnerAgreementAccepted/);
  assert.match(route, /partner_agreement_accepted_at, partner_agreement_version/);
  assert.match(migration, /partner_agreement_accepted_at timestamptz/);
});
