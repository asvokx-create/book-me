import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { complimentaryProExpiration, isComplimentaryProActive, isComplimentaryProDuration, paidSubscriptionProvidesPro } from "../lib/complimentary-pro-policy.ts";
import { calculateBookingFinancialSnapshot } from "../lib/booking-financials.ts";
import { PLAN_ENTITLEMENTS } from "../lib/plans.ts";

test("complimentary Pro supports every approved duration and calendar-safe extensions", () => {
  const start = new Date("2028-01-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "30_days", startsAt: start })?.toISOString(), "2028-03-01T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "2_months", startsAt: start })?.toISOString(), "2028-03-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "3_months", startsAt: start })?.toISOString(), "2028-04-30T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "6_months", startsAt: start })?.toISOString(), "2028-07-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "1_year", startsAt: start })?.toISOString(), "2029-01-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "lifetime", startsAt: start }), null);
  assert.equal(complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 45 })?.toISOString(), "2028-03-16T12:00:00.000Z");
  assert.throws(() => complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 0 }), /between 1 and 3,650/);
  assert.throws(() => complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 3651 }), /between 1 and 3,650/);
});

test("two complimentary calendar months preserve the UTC instant and clamp short months", () => {
  assert.equal(complimentaryProExpiration({ duration: "2_months", startsAt: new Date("2026-10-25T19:15:00.000Z") })?.toISOString(), "2026-12-25T19:15:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "2_months", startsAt: new Date("2026-12-29T08:00:00.000Z") })?.toISOString(), "2027-02-28T08:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "2_months", startsAt: new Date("2026-12-30T08:00:00.000Z") })?.toISOString(), "2027-02-28T08:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "2_months", startsAt: new Date("2026-12-31T08:00:00.000Z") })?.toISOString(), "2027-02-28T08:00:00.000Z");
});

test("active status handles expiration, lifetime access, future starts, and revocation", () => {
  const now = new Date("2028-02-01T00:00:00.000Z");
  assert.equal(isComplimentaryProActive({ startsAt: new Date("2028-01-01Z"), expiresAt: new Date("2028-03-01Z"), revokedAt: null }, now), true);
  assert.equal(isComplimentaryProActive({ startsAt: new Date("2028-01-01Z"), expiresAt: null, revokedAt: null }, now), true);
  assert.equal(isComplimentaryProActive({ startsAt: new Date("2028-02-02Z"), expiresAt: null, revokedAt: null }, now), false);
  assert.equal(isComplimentaryProActive({ startsAt: new Date("2028-01-01Z"), expiresAt: new Date("2028-02-01Z"), revokedAt: null }, now), false);
  assert.equal(isComplimentaryProActive({ startsAt: new Date("2028-01-01Z"), expiresAt: null, revokedAt: new Date("2028-01-15Z") }, now), false);
});

test("paid subscription detection blocks overlapping grants only for the current Stripe mode", () => {
  for (const status of ["active", "trialing", "past_due"]) assert.equal(paidSubscriptionProvidesPro({ subscriptionId: "sub_123", status, billingMode: "live" }, "live"), true);
  assert.equal(paidSubscriptionProvidesPro({ subscriptionId: null, status: "active", billingMode: "live" }, "live"), false);
  assert.equal(paidSubscriptionProvidesPro({ subscriptionId: "sub_123", status: "canceled", billingMode: "live" }, "live"), false);
  assert.equal(paidSubscriptionProvidesPro({ subscriptionId: "sub_123", status: "active", billingMode: "test" }, "live"), false);
});

test("complimentary Pro receives Pro booking fees and snapshots remain immutable", () => {
  const pro = calculateBookingFinancialSnapshot(500_000, "pro");
  assert.equal(pro.providerFeeCents, 10_000);
  assert.equal(pro.providerFeeCapCents, 10_000);
  assert.equal(pro.providerFeeBasisPoints, 600);
  const saved = structuredClone(pro);
  calculateBookingFinancialSnapshot(500_000, "starter");
  assert.deepEqual(pro, saved);
});

test("complimentary Pro maps to every configured Pro entitlement", () => {
  assert.deepEqual(PLAN_ENTITLEMENTS.pro, {
    name: "Pro",
    monthlyPrice: 9.99,
    bookingFeePercent: 6,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: 3,
    advancedAnalytics: true,
    customBookingQuestions: true,
    reminderHours: [24, 1],
    repeatCustomerTools: true,
    promotions: true,
    multipleLocations: true,
    prioritySupport: true,
    featuredPlacement: true,
  });
});

test("bookings before, during, and after a grant retain independent fee snapshots", () => {
  const before = calculateBookingFinancialSnapshot(500_000, "starter");
  const during = calculateBookingFinancialSnapshot(500_000, "pro");
  const after = calculateBookingFinancialSnapshot(500_000, "starter");
  assert.deepEqual({ fee: before.providerFeeCents, cap: before.providerFeeCapCents, rate: before.providerFeeBasisPoints }, { fee: 20_000, cap: 20_000, rate: 1_000 });
  assert.deepEqual({ fee: during.providerFeeCents, cap: during.providerFeeCapCents, rate: during.providerFeeBasisPoints }, { fee: 10_000, cap: 10_000, rate: 600 });
  assert.deepEqual(after, before);
});

test("grant endpoints, Stripe safeguards, expiry job, and audit history are wired server-side", async () => {
  const [route, checkout, webhook, booking, cron, migration, adminUi, billingUi] = await Promise.all([
    readFile(new URL("../app/api/admin/providers/[providerId]/complimentary-pro/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/subscriptions/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/bookings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/payment-releases/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/097_complimentary_pro_grants.sql", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-complimentary-pro.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/billing-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getAdminSession/);
  assert.match(route, /hasTrustedRequestOrigin/);
  assert.match(route, /enforceRateLimit/);
  assert.match(checkout, /complimentary_pro_active/);
  assert.match(checkout, /No paid subscription is needed/);
  assert.match(webhook, /effectivePro = active \|\|/);
  assert.match(webhook, /customer\.subscription\.deleted[\s\S]*complimentary_pro_grants complimentary[\s\S]*THEN 'pro' ELSE 'starter'/);
  assert.match(booking, /entitlement\.effective_plan AS plan/);
  assert.match(cron, /reconcileExpiredComplimentaryProGrants/);
  assert.match(migration, /complimentary_pro_grant_events/);
  assert.match(migration, /expired_once_idx/);
  assert.match(adminUi, /window\.confirm/);
  assert.match(adminUi, /30 days/);
  assert.match(adminUi, /2 calendar months/);
  assert.match(adminUi, /Expected expiration/);
  assert.match(adminUi, /Lifetime/);
  assert.match(billingUi, /You have complimentary Pro access until/);
  for (const source of [checkout, webhook, booking]) assert.doesNotMatch(source, /complimentary_pro_grants\s+grant\b/);
  const complimentarySource = await readFile(new URL("../lib/complimentary-pro.ts", import.meta.url), "utf8");
  assert.doesNotMatch(complimentarySource, /complimentary_pro_grants\s+grant\b/);
  assert.match(complimentarySource, /FOR UPDATE/);
  assert.match(complimentarySource, /ORDER BY provider\.id FOR UPDATE OF provider/);
  assert.doesNotMatch(complimentarySource, /SELECT DISTINCT provider\.id::text AS provider_id/);
  assert.match(complimentarySource, /EXISTS \(\s*SELECT 1 FROM complimentary_pro_grants complimentary/);
  assert.match(complimentarySource, /await client\.query\("BEGIN"\)[\s\S]*await client\.query\("COMMIT"\)/);
  assert.match(complimentarySource, /NOT EXISTS \(SELECT 1 FROM complimentary_pro_grants active/);
  assert.match(complimentarySource, /SUBSCRIPTION_CHECKOUT_PENDING/);
  assert.doesNotMatch(complimentarySource, /checkout\.sessions\.create|subscriptions\.create|invoices\.create|paymentIntents\.create/);
  assert.doesNotMatch(complimentarySource, /DELETE FROM (services|bookings|provider_imported_customers|provider_companies|provider_locations)/);
  assert.match(billingUi, /You will not be charged a Pro subscription fee/);
  assert.match(billingUi, /automatically return to Starter/);
});

test("expired grants are reconciled during protected requests even if the scheduled job does not run", async () => {
  const sources = await Promise.all([
    "../lib/provider-access.ts",
    "../lib/marketplace.ts",
    "../lib/recurring-bookings.ts",
    "../app/api/providers/services/[serviceId]/route.ts",
    "../app/api/providers/services/[serviceId]/images/route.ts",
    "../app/api/providers/onboarding/route.ts",
    "../app/api/providers/revenue/route.ts",
    "../app/api/coupons/validate/route.ts",
    "../app/api/quotes/[quoteId]/route.ts",
    "../app/api/bookings/[bookingId]/route.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of sources) assert.match(source, /reconcileExpiredComplimentaryProGrants/);
});

test("duration values reject manipulation", () => {
  for (const value of ["30_days", "2_months", "3_months", "6_months", "1_year", "lifetime", "custom"]) assert.equal(isComplimentaryProDuration(value), true);
  for (const value of ["forever", -1, null, { duration: "lifetime" }]) assert.equal(isComplimentaryProDuration(value), false);
});
