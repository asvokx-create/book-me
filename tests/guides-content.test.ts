import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("guides explain current marketplace, partner, and payout behavior", async () => {
  const [guides, indexPage, articlePage] = await Promise.all([
    readFile(new URL("../lib/guides.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guides/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(guides, /creator-partner-earnings-tracking-and-payouts/);
  assert.match(guides, /A click or signup does not create earnings/);
  assert.match(guides, /does not pay 20% of the provider’s service price/);
  assert.match(guides, /protected amount is based on recorded unpaid affiliate obligations/);
  assert.match(guides, /A marketplace service request is posted by a customer/);
  assert.match(guides, /This process is not an escrow, trust, deposit, or bank account/);
  assert.match(indexPage, /audienceValue === "partners"/);
  assert.match(indexPage, /For partners/);
  assert.match(articlePage, /href="\/partner-agreement"/);
  assert.match(articlePage, /current legal policies control/);
});
