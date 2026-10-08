import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("guides and homepage explain current marketplace, partner, and payout behavior", async () => {
  const [guides, indexPage, articlePage, homePage] = await Promise.all([
    readFile(new URL("../lib/guides.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(guides, /creator-partner-earnings-tracking-and-payouts/);
  assert.match(guides, /A click or signup does not create earnings/);
  assert.match(guides, /eligible BubsBookings revenue, not the provider’s gross service price/);
  assert.match(guides, /Do not promise a particular amount, rate, or payout date/);
  assert.match(guides, /protected amount is based on recorded unpaid affiliate obligations/);
  assert.match(guides, /A marketplace request is matched by category and delivery type/);
  assert.match(guides, /a private street address is never needed for remote work/);
  assert.match(guides, /This process is not an escrow, trust, deposit, or bank account/);
  assert.match(indexPage, /audienceValue === "partners"/);
  assert.match(indexPage, /For partners/);
  assert.match(articlePage, /href="\/partner-agreement"/);
  assert.match(articlePage, /current legal policies control/);
  assert.match(homePage, /Partner Program/);
  assert.match(homePage, /Share BubsBookings\. Earn when providers succeed\./);
  assert.match(homePage, /href="\/partners"/);
});
