import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { addCalendarMonthsClamped, affiliateRevenueShareWindow, calculateAffiliateCommission, isAffiliateRevenueShareActive } from "../lib/affiliate-rules.ts";
import { runAffiliateSandbox } from "../scripts/run-affiliate-sandbox.ts";

test("sandbox bot proves affiliate link to provider purchase earnings", async () => {
  const report = await runAffiliateSandbox();
  assert.equal(report.mode, "local-simulation");
  assert.equal(report.attribution.locked, true);
  assert.equal(report.attribution.source, "affiliate-link");
  assert.equal(report.purchase.servicePriceCents, 25_000);
  assert.equal(report.purchase.customerTotalCents, 25_299);
  assert.equal(report.purchase.providerMarketplaceFeeCents, 2_500);
  assert.equal(report.purchase.providerPayoutCents, 22_500);
  assert.equal(report.affiliate.revenueShareBasisPoints, 2_000);
  assert.equal(report.affiliate.revenueShareCents, 500);
  assert.equal(report.affiliate.activationBonusCents, 1_000);
  assert.equal(report.affiliate.totalHeldCents, 1_500);
  assert.equal(report.affiliate.holdPeriodDays, 14);
});

test("six calendar months are clamped without spilling into extra days", () => {
  const august31 = new Date("2026-08-31T12:00:00.000Z");
  assert.equal(addCalendarMonthsClamped(august31, 6).toISOString(), "2027-02-28T12:00:00.000Z");
  const { end } = affiliateRevenueShareWindow(august31, 6);
  assert.equal(isAffiliateRevenueShareActive({ startedAt: august31, durationMonths: 6, at: new Date(end.getTime() - 1) }), true);
  assert.equal(isAffiliateRevenueShareActive({ startedAt: august31, durationMonths: 6, at: end }), false);
});

test("standard share is exactly 20% and cannot earn after expiration", async () => {
  const startedAt = new Date("2026-03-15T08:00:00.000Z");
  const justBeforeEnd = new Date("2026-09-15T07:59:59.999Z");
  const atEnd = new Date("2026-09-15T08:00:00.000Z");
  const eligibleFeeRevenueCents = 2_500;
  assert.equal(calculateAffiliateCommission(eligibleFeeRevenueCents, 2_000), 500);
  assert.equal(isAffiliateRevenueShareActive({ startedAt, durationMonths: 6, at: justBeforeEnd }), true);
  assert.equal(isAffiliateRevenueShareActive({ startedAt, durationMonths: 6, at: atEnd }), false);
  const expired = await runAffiliateSandbox({ startedAt, bookingAt: atEnd });
  assert.equal(expired.affiliate.revenueShareCents, 0);
});

test("a fixed campaign end is independent from a referred provider's six-month revenue-share window", () => {
  // The default program starts a referral's revenue-share clock when the provider
  // qualifies. Here the November 5 booking is the qualifying booking for a
  // provider referred on October 15; the campaign itself ends November 12.
  const qualifyingBookingAt = new Date("2026-11-05T18:00:00.000Z");
  const campaignEndsAt = new Date("2026-11-12T23:59:59.999Z");
  const { end } = affiliateRevenueShareWindow(qualifyingBookingAt, 6);

  // A: qualifying revenue during the campaign is eligible.
  assert.equal(isAffiliateRevenueShareActive({ startedAt: qualifyingBookingAt, durationMonths: 6, at: qualifyingBookingAt }), true);
  // B/E: the campaign end does not remove attribution or stop an active share.
  assert.equal(campaignEndsAt < new Date("2026-11-20T18:00:00.000Z"), true);
  assert.equal(isAffiliateRevenueShareActive({ startedAt: qualifyingBookingAt, durationMonths: 6, at: new Date("2026-11-20T18:00:00.000Z") }), true);
  // C: later eligible revenue remains in scope for the full calendar duration.
  assert.equal(isAffiliateRevenueShareActive({ startedAt: qualifyingBookingAt, durationMonths: 6, at: new Date("2027-04-30T18:00:00.000Z") }), true);
  // D: it ends at the exact six-month boundary, not at the campaign end.
  assert.equal(end.toISOString(), "2027-05-05T18:00:00.000Z");
  assert.equal(isAffiliateRevenueShareActive({ startedAt: qualifyingBookingAt, durationMonths: 6, at: end }), false);
});

test("campaign fields are never consulted by the revenue-share eligibility engine", async () => {
  const engine = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  const campaignPersistence = await readFile(new URL("../app/api/admin/affiliates/route.ts", import.meta.url), "utf8");

  // F: campaign records support the fixed obligation and administrative status;
  // the booking commission engine relies only on immutable referral terms.
  assert.doesNotMatch(engine, /custom_campaign|campaign_ends_on|campaignEndsOn/i);
  assert.match(campaignPersistence, /campaign_ends_on=EXCLUDED\.campaign_ends_on/);
  assert.match(campaignPersistence, /revenue_share_duration_months=EXCLUDED\.revenue_share_duration_months/);
});

test("sandbox bot refuses live Stripe credentials", async () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_live_not-a-real-key";
  try {
    await assert.rejects(() => runAffiliateSandbox({ runStripe: true }), /sandbox\/test key/);
  } finally {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  }
});
