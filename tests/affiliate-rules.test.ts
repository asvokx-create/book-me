import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { calculateAffiliateCommission, calculateEligibleProviderFeeRevenue } from "../lib/affiliate-rules.ts";

test("affiliate share uses BubsBookings provider fee revenue, not gross booking value", () => {
  const eligible = calculateEligibleProviderFeeRevenue({ providerMarketplaceFeeCents: 1000, bookingPriceCents: 10_000, refundedServiceAmountCents: 0 });
  assert.equal(eligible, 1000);
  assert.equal(calculateAffiliateCommission(eligible, 2000), 200);
});

test("partial refunds proportionally reduce eligible provider fee revenue", () => {
  const eligible = calculateEligibleProviderFeeRevenue({ providerMarketplaceFeeCents: 5000, bookingPriceCents: 50_000, refundedServiceAmountCents: 20_000 });
  assert.equal(eligible, 3000);
  assert.equal(calculateAffiliateCommission(eligible, 2000), 600);
});

test("affiliate architecture snapshots terms and keeps payout and reversal history", async () => {
  const migration = await readFile(new URL("../database/migrations/058_affiliate_partner_system.sql", import.meta.url), "utf8");
  const engine = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  assert.match(migration, /activation_bonus_cents[\s\S]*revenue_share_basis_points[\s\S]*hold_period_days/);
  assert.match(migration, /affiliate_commissions[\s\S]*affiliate_payouts[\s\S]*affiliate_audit_log/);
  assert.match(engine, /provider_marketplace_fee/);
  assert.match(engine, /commission_type='reversal'/);
  assert.doesNotMatch(engine, /customer_service_fee_cents/);
});

test("affiliate earnings are synchronized only after the provider payout succeeds", async () => {
  const payout = await readFile(new URL("../lib/payment-release.ts", import.meta.url), "utf8");
  const engine = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  const payoutMarkedPaid = payout.indexOf("payment_release_status = 'paid_out'");
  const affiliateSync = payout.indexOf("syncAffiliateCommissionForBooking(bookingId, client)");

  assert.ok(payoutMarkedPaid >= 0, "provider payout must be marked paid");
  assert.ok(affiliateSync > payoutMarkedPaid, "affiliate earnings must be synced after provider payout succeeds");
  assert.match(engine, /booking_status === "completed"/);
  assert.match(engine, /payment_status === "paid"/);
  assert.match(engine, /\["paid_out", "partially_released"\]\.includes\(row\.payment_release_status\)/);
  assert.match(engine, /row\.refunded_amount_cents < row\.price_cents/);
  assert.match(engine, /!disputeOpen && !disputeLost/);
});

test("affiliate attribution is active-only, single-use, and blocks self-referrals", async () => {
  const engine = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  const clickRoute = await readFile(new URL("../app/api/affiliates/attribution/route.ts", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/providers/onboarding/route.ts", import.meta.url), "utf8");

  assert.match(clickRoute, /affiliate\.status = 'active'/);
  assert.match(engine, /affiliate\.status = 'active'/);
  assert.match(engine, /used_referral\.click_id = click\.id/);
  assert.match(engine, /affiliate\.user_id = referred_owner\.id/);
  assert.match(engine, /lower\(affiliate\.email\) = lower\(referred_owner\.email\)/);
  assert.match(onboarding, /affiliateAttributionLocked/);
  assert.match(onboarding, /response\.cookies\.delete\(AFFILIATE_COOKIE\)/);
});

test("eligible commissions recover after a provider wins a dispute", async () => {
  const engine = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  assert.match(engine, /WHERE booking_id::text = \$1 AND status = 'disputed'/);
  assert.match(engine, /payable_at IS NOT NULL AND payable_at <= now\(\) THEN 'payable' ELSE 'hold'/);
  assert.match(engine, /reversal_reason = NULL/);
  assert.match(engine, /status = 'revenue_share_ended'/);
});

test("partner application, dashboard, and public disclosure match activation behavior", async () => {
  const page = await readFile(new URL("../app/partners/page.tsx", import.meta.url), "utf8");
  const application = await readFile(new URL("../components/partner-application-form.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../app/affiliate/page.tsx", import.meta.url), "utf8");
  const cookieNotice = await readFile(new URL("../app/cookies/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Who this is for/);
  assert.match(page, /FAQPage/);
  assert.match(page, /Apply to become a partner/);
  assert.match(application, /Submission is an application only; it does not approve or activate/);
  assert.match(dashboard, /awaiting activation/);
  assert.match(dashboard, /Lifetime earnings/);
  assert.match(dashboard, /revenue_share_ends_at IS NULL OR revenue_share_ends_at >= now\(\)/);
  assert.match(cookieNotice, /cleared after a successful provider attribution/);
});
