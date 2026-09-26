import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

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
  assert.match(privacy, /detach the sign-in account while retaining the partner application/);
  assert.match(privacy, /does not include[\s\S]*every Stripe, affiliate, administrative/);
  assert.match(cookies, /<code>_ga<\/code>/);
  assert.match(cookies, /does not currently provide a separate on-site switch/);
  assert.match(contentRemoval, /no later than 48 hours/);
  assert.match(contentRemoval, /copyright\.gov\/512/);
});
