import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { complimentaryProExpiration, isComplimentaryProActive, isComplimentaryProDuration, paidSubscriptionProvidesPro } from "../lib/complimentary-pro-policy.ts";
import { calculateBookingFinancialSnapshot } from "../lib/booking-financials.ts";

test("complimentary Pro supports every approved duration and calendar-safe extensions", () => {
  const start = new Date("2028-01-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "30_days", startsAt: start })?.toISOString(), "2028-03-01T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "3_months", startsAt: start })?.toISOString(), "2028-04-30T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "6_months", startsAt: start })?.toISOString(), "2028-07-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "1_year", startsAt: start })?.toISOString(), "2029-01-31T12:00:00.000Z");
  assert.equal(complimentaryProExpiration({ duration: "lifetime", startsAt: start }), null);
  assert.equal(complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 45 })?.toISOString(), "2028-03-16T12:00:00.000Z");
  assert.throws(() => complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 0 }), /between 1 and 3,650/);
  assert.throws(() => complimentaryProExpiration({ duration: "custom", startsAt: start, customDays: 3651 }), /between 1 and 3,650/);
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
  assert.match(booking, /entitlement\.effective_plan AS plan/);
  assert.match(cron, /reconcileExpiredComplimentaryProGrants/);
  assert.match(migration, /complimentary_pro_grant_events/);
  assert.match(migration, /expired_once_idx/);
  assert.match(adminUi, /window\.confirm/);
  assert.match(adminUi, /30 days/);
  assert.match(adminUi, /Lifetime/);
  assert.match(billingUi, /Your complimentary Pro access continues through/);
  for (const source of [checkout, webhook, booking]) assert.doesNotMatch(source, /complimentary_pro_grants\s+grant\b/);
  const complimentarySource = await readFile(new URL("../lib/complimentary-pro.ts", import.meta.url), "utf8");
  assert.doesNotMatch(complimentarySource, /complimentary_pro_grants\s+grant\b/);
});

test("duration values reject manipulation", () => {
  for (const value of ["30_days", "3_months", "6_months", "1_year", "lifetime", "custom"]) assert.equal(isComplimentaryProDuration(value), true);
  for (const value of ["forever", -1, null, { duration: "lifetime" }]) assert.equal(isComplimentaryProDuration(value), false);
});
