import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("fixed creator campaigns remain separate from affiliate commissions and payouts", () => {
  const migration = read("database", "migrations", "061_creator_campaign_payments.sql");
  const api = read("app", "api", "admin", "affiliates", "route.ts");
  const admin = read("components", "affiliate-admin.tsx");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS creator_campaign_payments/);
  assert.match(migration, /fixed_amount_cents integer NOT NULL/);
  assert.match(migration, /payment_status IN \('planned','approved','paid','cancelled'\)/);
  assert.match(migration, /revenue_share_basis_points/);
  assert.match(migration, /revenue_share_duration_months/);
  assert.doesNotMatch(migration, /affiliate_commissions|affiliate_payouts/);
  assert.match(api, /action === "campaign_create"/);
  assert.match(api, /action === "campaign_status"/);
  assert.match(api, /No payment was sent|creator_campaign_created/);
  assert.match(admin, /Separate from affiliate commissions/);
  assert.match(admin, /No payment was sent/);
});

test("partner QR codes reuse the canonical referral link attribution path", () => {
  const builder = read("components", "affiliate-link-builder.tsx");
  const tracker = read("components", "affiliate-attribution-tracker.tsx");
  assert.match(builder, /url\.searchParams\.set\("ref", code\)/);
  assert.match(builder, /<QRCode value=\{link\}/);
  assert.match(tracker, /params\.get\("ref"\)/);
  assert.match(tracker, /fetch\("\/api\/affiliates\/attribution"/);
});

test("public Terms headings and anchors are sequential and semantic", () => {
  const terms = read("app", "terms", "page.tsx");
  const headings = [...terms.matchAll(/\["(\d+)\. ([^"]+)"/g)].map(match => Number(match[1]));
  assert.deepEqual(headings, Array.from({ length: 15 }, (_, index) => index + 1));
  assert.match(terms, /<h1[^>]*>\{title\}<\/h1>/);
  assert.match(terms, /<h2[^>]*>\{heading\}<\/h2>/);
  assert.match(terms, /href=\{`#\$\{id\}`\}/);
  assert.match(terms, /aria-label=\{`\$\{title\} sections`\}/);
});

test("the account header collapses its wordmark before controls overflow at 320px", () => {
  const account = read("app", "account", "page.tsx");
  assert.match(account, /<BrandLockup compact markOnlyOnMobile \/>/);
});

test("provider promotion uses the canonical listing share and QR infrastructure", () => {
  const marketing = read("components", "provider-marketing-tools.tsx");
  assert.match(marketing, /<ListingShareButton action="copy"/);
  assert.match(marketing, /<ListingShareButton serviceId=/);
  assert.match(marketing, /<QRCode value=\{listingUrl\}/);
  assert.match(marketing, /Instagram bio, website, Facebook page, texts, or business cards|business cards/);
  assert.doesNotMatch(marketing, /[?&]ref=/);
});
