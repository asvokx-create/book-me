import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  applyCancellationSetting,
  cancellationSettingForAction,
  canScheduleSubscriptionCancellation,
  requireConfirmedCancellationSetting,
  shouldApplySubscriptionEvent,
  subscriptionPeriodEndUnix,
} from "../lib/subscription-lifecycle.ts";
import { calculateBookingFinancialSnapshot } from "../lib/booking-financials.ts";

test("subscription period end uses the trial end during a trial and the billing period otherwise", () => {
  assert.equal(subscriptionPeriodEndUnix({ status: "trialing", cancel_at_period_end: false, trial_end: 1_800_000_000, items: { data: [{ current_period_end: 1_900_000_000 }] } }), 1_800_000_000);
  assert.equal(subscriptionPeriodEndUnix({ status: "active", cancel_at_period_end: true, trial_end: null, items: { data: [{ current_period_end: 1_900_000_000 }] } }), 1_900_000_000);
});

test("only subscriptions that Stripe can still manage support cancellation changes", () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused"]) {
    assert.equal(canScheduleSubscriptionCancellation(status), true);
  }
  for (const status of ["canceled", "incomplete", "incomplete_expired"]) {
    assert.equal(canScheduleSubscriptionCancellation(status), false);
  }
});

test("cancellation prevents renewal and reactivation restores renewal", () => {
  assert.equal(cancellationSettingForAction("cancel"), true);
  assert.equal(cancellationSettingForAction("resume"), false);
});

test("an unconfirmed Stripe cancellation response is rejected", () => {
  assert.doesNotThrow(() => requireConfirmedCancellationSetting(true, true));
  assert.doesNotThrow(() => requireConfirmedCancellationSetting(false, false));
  assert.throws(() => requireConfirmedCancellationSetting(true, false), /Stripe did not confirm/);
  assert.throws(() => requireConfirmedCancellationSetting(false, true), /Stripe did not confirm/);
});

test("mocked Stripe cancellation, idempotent retry, and reversal complete the full renewal lifecycle", async () => {
  type MockSubscription = {
    id: string;
    status: string;
    cancel_at_period_end: boolean;
    trial_end: number | null;
    items: { data: Array<{ current_period_end: number }> };
  };
  let stripeSubscription: MockSubscription = {
    id: "sub_test_pro",
    status: "active",
    cancel_at_period_end: false,
    trial_end: null,
    items: { data: [{ current_period_end: 1_900_000_000 }] },
  };
  const updates: Array<{ value: boolean; key: string }> = [];
  const update = async (_id: string, value: boolean, key: string) => {
    updates.push({ value, key });
    stripeSubscription = { ...stripeSubscription, cancel_at_period_end: value };
    return stripeSubscription;
  };

  const canceled = await applyCancellationSetting({ subscription: stripeSubscription, action: "cancel", operationId: "11111111-1111-4111-8111-111111111111", update });
  assert.equal(canceled.cancelAtPeriodEnd, true);
  assert.equal(canceled.periodEnd, 1_900_000_000);
  assert.equal(canceled.stateChanged, true);
  assert.equal(updates.length, 1);
  assert.match(updates[0].key, /^provider-subscription-cancel-sub_test_pro-/);

  const retry = await applyCancellationSetting({ subscription: stripeSubscription, action: "cancel", operationId: "11111111-1111-4111-8111-111111111111", update });
  assert.equal(retry.stateChanged, false);
  assert.equal(updates.length, 1);

  const resumed = await applyCancellationSetting({ subscription: stripeSubscription, action: "resume", operationId: "22222222-2222-4222-8222-222222222222", update });
  assert.equal(resumed.cancelAtPeriodEnd, false);
  assert.equal(resumed.stateChanged, true);
  assert.equal(updates.length, 2);
  assert.match(updates[1].key, /^provider-subscription-resume-sub_test_pro-/);
});

test("mocked Stripe failure cannot be mistaken for a confirmed local cancellation", async () => {
  const subscription = { id: "sub_failure", status: "active", cancel_at_period_end: false, trial_end: null, items: { data: [{ current_period_end: 1_900_000_000 }] } };
  await assert.rejects(
    applyCancellationSetting({
      subscription,
      action: "cancel",
      operationId: "33333333-3333-4333-8333-333333333333",
      update: async () => { throw new Error("Synthetic Stripe outage"); },
    }),
    /Synthetic Stripe outage/,
  );
  assert.equal(subscription.cancel_at_period_end, false);
});

test("older subscription webhook events cannot override a newer lifecycle state", () => {
  assert.equal(shouldApplySubscriptionEvent(null, 100), true);
  assert.equal(shouldApplySubscriptionEvent(100, 100), true);
  assert.equal(shouldApplySubscriptionEvent(100, 101), true);
  assert.equal(shouldApplySubscriptionEvent(101, 100), false);
});

test("Starter and Pro booking fee snapshots remain independent of later subscription changes", () => {
  const pro = calculateBookingFinancialSnapshot(500_000, "pro");
  const starter = calculateBookingFinancialSnapshot(500_000, "starter");
  assert.equal(pro.providerFeeBasisPoints, 600);
  assert.equal(pro.providerFeeCapCents, 10_000);
  assert.equal(pro.providerFeeCents, 10_000);
  assert.equal(starter.providerFeeBasisPoints, 1_000);
  assert.equal(starter.providerFeeCapCents, 20_000);
  assert.equal(starter.providerFeeCents, 20_000);
});

test("self-service cancellation is Stripe-confirmed, authorized, idempotent, reversible, and sends confirmation", async () => {
  const [route, panel, status, webhook, migration] = await Promise.all([
    readFile(new URL("../app/api/stripe/subscriptions/manage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/billing-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/094_subscription_cancellation_state.sql", import.meta.url), "utf8"),
  ]);

  assert.match(route, /auth\.api\.getSession/);
  assert.match(route, /Invalid request origin/);
  assert.match(route, /enforceRateLimit/);
  assert.match(route, /metadata\.providerId !== provider\.id/);
  assert.match(route, /metadata\.plan !== "pro"/);
  assert.match(route, /operationId/);
  assert.match(route, /idempotencyKey/);
  assert.match(route, /cancel_at_period_end: cancelAtPeriodEnd/);
  assert.match(route, /applyCancellationSetting/);
  assert.match(route, /sendTransactionalEmail/);
  assert.match(route, /INSERT INTO notifications/);
  assert.match(route, /Refresh Billing to verify your current renewal setting/);

  assert.match(panel, /Cancel subscription/);
  assert.match(panel, /Keep Pro plan/);
  assert.match(panel, /formatBillingDate\(status\.currentPeriodEnd\)/);
  assert.match(panel, /crypto\.randomUUID\(\)/);
  assert.match(panel, /flex-wrap/);

  assert.match(status, /subscriptions\.retrieve/);
  assert.match(status, /stripe_cancel_at_period_end/);
  assert.match(status, /subscriptionStateVerified/);
  assert.match(webhook, /customer\.subscription\.updated/);
  assert.match(webhook, /stripe_subscription_event_created_at/);
  assert.match(webhook, /stripe_subscription_status = 'canceled'/);
  assert.match(webhook, /customer\.subscription\.deleted/);
  assert.match(webhook, /THEN 'pro' ELSE 'starter' END/);
  assert.match(webhook, /FROM complimentary_pro_grants/);
  assert.match(webhook, /provider\.rows\[0\]\.plan !== "pro"/);
  assert.match(webhook, /stripe_cancel_at_period_end = false/);
  assert.doesNotMatch(webhook, /DELETE FROM (services|bookings|messages|provider_customers)/i);
  assert.match(migration, /stripe_cancel_at_period_end boolean NOT NULL DEFAULT false/);
});

test("Stripe is called before local cancellation state is recorded and failures stay explicit", async () => {
  const route = await readFile(new URL("../app/api/stripe/subscriptions/manage/route.ts", import.meta.url), "utf8");
  const stripeUpdate = route.indexOf("stripe.subscriptions.update");
  const localUpdate = route.indexOf("UPDATE provider_profiles SET stripe_subscription_status");
  assert.ok(stripeUpdate >= 0);
  assert.ok(localUpdate > stripeUpdate);
  assert.match(route, /Stripe could not confirm the subscription update/);
  assert.match(route, /status: 502/);
});
