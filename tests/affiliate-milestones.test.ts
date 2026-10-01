import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTIVE_PROVIDER_REQUIRED_BOOKINGS,
  STANDARD_PROVIDER_GROWTH_MILESTONES,
  milestoneConfig,
  milestoneProgressPercent,
  nextProviderGrowthMilestone,
  qualifiesAsActiveProvider,
} from "../lib/affiliate-milestone-config.ts";

test("the standard growth schedule is cumulative and totals $900", () => {
  assert.deepEqual(STANDARD_PROVIDER_GROWTH_MILESTONES.map(item => [item.threshold,item.bonusCents]), [[10,5000],[25,10000],[50,25000],[100,50000]]);
  assert.equal(STANDARD_PROVIDER_GROWTH_MILESTONES.reduce((sum,item)=>sum+item.bonusCents,0),90000);
});

test("an Active Provider requires four qualified paid bookings", () => {
  assert.equal(ACTIVE_PROVIDER_REQUIRED_BOOKINGS,4);
  assert.equal(qualifiesAsActiveProvider(3),false);
  assert.equal(qualifiesAsActiveProvider(4),true);
  assert.equal(qualifiesAsActiveProvider(9),true);
});

test("progress advances between milestone bands", () => {
  const milestones=milestoneConfig([25,10,100,50],[10000,5000,50000,25000]);
  assert.deepEqual(milestones.map(item=>item.threshold),[10,25,50,100]);
  assert.equal(nextProviderGrowthMilestone(10,milestones)?.threshold,25);
  assert.equal(milestoneProgressPercent(10,milestones),0);
  assert.equal(milestoneProgressPercent(100,milestones),100);
});

test("migration makes milestone creation idempotent and requires historical approval", () => {
  const migration=readFileSync(new URL("../database/migrations/067_provider_growth_milestones.sql",import.meta.url),"utf8");
  assert.match(migration,/UNIQUE \(affiliate_id, milestone_threshold\)/);
  assert.match(migration,/milestone_backfill_approved = false/);
  assert.match(migration,/commission_type IN \('activation_bonus','revenue_share','milestone_bonus'/);
});

test("qualification rejects unresolved disputes, refunds, and restricted providers", () => {
  const source=readFileSync(new URL("../lib/affiliate-milestones.ts",import.meta.url),"utf8");
  assert.match(source,/refunded_amount_cents < booking\.price_cents/);
  assert.match(source,/booking_disputes/);
  assert.match(source,/account_restrictions/);
  assert.match(source,/payment_release_status IN \('paid_out','partially_released'\)/);
});

test("milestone email and notification use stable idempotency keys", () => {
  const source=readFileSync(new URL("../lib/affiliate-milestones.ts",import.meta.url),"utf8");
  assert.match(source,/partner-milestone:\$\{affiliateId\}:\$\{milestone\.threshold\}/);
  assert.match(source,/partner-growth-milestone-\$\{item\.id\}/);
});

test("affiliate dashboard places Provider Growth before setup and analytics content", () => {
  const page=readFileSync(new URL("../app/affiliate/page.tsx",import.meta.url),"utf8");
  const dashboardStart=page.indexOf('aria-label="Analytics date range"');
  const milestonePosition=page.indexOf("{milestoneProgress ? <ProviderGrowthMilestones",dashboardStart);
  const stripeSetupPosition=page.indexOf("<AffiliateStripeSetup",dashboardStart);
  const analyticsPosition=page.indexOf('[["Clicks", stats.clicks]',dashboardStart);
  const linkBuilderPosition=page.indexOf("<AffiliateLinkBuilder",dashboardStart);
  assert.ok(milestonePosition > dashboardStart);
  assert.ok(milestonePosition < stripeSetupPosition);
  assert.ok(milestonePosition < analyticsPosition);
  assert.ok(milestonePosition < linkBuilderPosition);
});
