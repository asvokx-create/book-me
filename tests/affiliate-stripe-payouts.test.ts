import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("affiliate Stripe setup uses hosted recipient onboarding and stores no bank credentials", async () => {
  const migration = await readFile(new URL("../database/migrations/059_affiliate_stripe_payouts.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/affiliates/stripe/connect/route.ts", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/affiliate-stripe-setup.tsx", import.meta.url), "utf8");

  assert.match(migration, /stripe_account_id[\s\S]*stripe_payouts_enabled[\s\S]*stripe_transfer_id/);
  assert.match(route, /type: "express"/);
  assert.match(route, /service_agreement: "recipient"/);
  assert.match(route, /capabilities: \{ transfers: \{ requested: true \} \}/);
  assert.match(route, /type: "account_onboarding"/);
  assert.doesNotMatch(migration, /routing_number|account_number|bank_login/i);
  assert.match(dashboard, /Set up Stripe payouts/);
  assert.match(dashboard, /Continue Stripe setup/);
  assert.match(dashboard, /Stripe payouts ready/);
});

test("affiliate payouts create real idempotent Stripe transfers and remain retryable", async () => {
  const payout = await readFile(new URL("../lib/affiliate-payouts.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/affiliates/route.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8");

  assert.match(payout, /getStripe\(\)\.transfers\.create/);
  assert.match(payout, /affiliate-payout-\$\{mode\}-\$\{payout\.id\}-attempt-\$\{payout\.stripe_attempt_count\}/);
  assert.match(payout, /destination: payout\.stripe_account_id/);
  assert.match(payout, /status='failed'/);
  assert.match(admin, /action === "payout_send"/);
  assert.doesNotMatch(admin, /action === "payout_paid"/);
  assert.match(webhook, /affiliatePayoutId/);
  assert.match(webhook, /reverseAffiliatePayoutTransfer/);
  assert.match(payout, /affiliate_stripe_transfer_reversed/);
  assert.match(payout, /stripe_attempt_count=stripe_attempt_count\+CASE WHEN \$4 THEN 1 ELSE 0 END/);
  assert.match(payout, /partially reversed[\s\S]*Manual review is required/);
  assert.match(payout, /status IN \('pending','processing','failed','paid'\)/);
});

test("affiliate transfers require both Stripe and tax readiness", async () => {
  const payout = await readFile(new URL("../lib/affiliate-payouts.ts", import.meta.url), "utf8");
  const status = await readFile(new URL("../app/api/affiliates/stripe/status/route.ts", import.meta.url), "utf8");
  const agreement = await readFile(new URL("../app/partner-agreement/page.tsx", import.meta.url), "utf8");

  assert.match(payout, /affiliate\.stripe_payouts_enabled = true/);
  assert.match(payout, /affiliate\.payment_status = 'ready'/);
  assert.match(payout, /affiliate\.tax_onboarding_status = 'complete'/);
  assert.match(status, /account\.capabilities\?\.transfers === "active"/);
  assert.match(agreement, /connected Stripe balance/);
});

test("affiliate obligations are reserved in operations and eligible payouts run automatically", async () => {
  const payout = await readFile(new URL("../lib/affiliate-payouts.ts", import.meta.url), "utf8");
  const cron = await readFile(new URL("../app/api/cron/payment-releases/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../components/affiliate-admin.tsx", import.meta.url), "utf8");

  assert.match(payout, /status IN \('pending','hold','approved','payable'\)/);
  assert.match(payout, /getStripe\(\)\.balance\.retrieve/);
  assert.match(payout, /AFFILIATE_RESERVE_BUFFER_CENTS/);
  assert.match(payout, /sum\(GREATEST\(affiliate_obligation_cents,0\)\)/);
  assert.match(payout, /runAutomatedAffiliatePayouts/);
  assert.match(payout, /affiliate\.tax_onboarding_status='complete'/);
  assert.match(payout, /payout\.status='processing' AND payout\.updated_at < now\(\) - interval '10 minutes'/);
  assert.match(cron, /advanceAffiliateCommissions[\s\S]*runAutomatedAffiliatePayouts/);
  assert.match(admin, /Affiliate reserve needs funding/);
  assert.match(admin, /Funding gap/);
});

test("owner payouts run only on Friday and send only Stripe funds above the protected reserve", async () => {
  const payout = await readFile(new URL("../lib/affiliate-payouts.ts", import.meta.url), "utf8");
  const cron = await readFile(new URL("../app/api/cron/payment-releases/route.ts", import.meta.url), "utf8");
  const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(payout, /PROTECTED_OWNER_PAYOUTS_ENABLED !== "true"/);
  assert.match(payout, /timeZone: "America\/Los_Angeles"/);
  assert.match(payout, /value\("weekday"\) !== "Friday"/);
  assert.match(payout, /reason: "already_sent"/);
  assert.match(payout, /reserve\.availableCents - reserve\.requiredCents/);
  assert.match(payout, /getStripe\(\)\.payouts\.create/);
  assert.match(payout, /protected-owner-payout-\$\{getStripeMode\(\)\}-\$\{dateKey\}/);
  assert.match(cron, /runAutomatedAffiliatePayouts\(\)[\s\S]*runProtectedOwnerPayout\(\)/);
  assert.match(env, /PROTECTED_OWNER_PAYOUTS_ENABLED=false/);
});
