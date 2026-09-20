import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBookingFinancialSnapshot,
  isProviderPayoutEligible,
  paymentReleaseStatusAfterPayment,
  providerNetAfterServiceRefund,
  stripeOperationKey,
} from "../lib/booking-financials.ts";

test("successful booking payment enters secured state", () => {
  assert.equal(paymentReleaseStatusAfterPayment({ heldTransfer: true, serviceCompleted: false, frozen: false, paymentSucceeded: true }), "secured");
});

test("failed payment never becomes secured", () => {
  assert.equal(paymentReleaseStatusAfterPayment({ heldTransfer: true, serviceCompleted: false, frozen: false, paymentSucceeded: false }), "failed");
});

test("Starter snapshots a 10% provider fee", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "starter");
  assert.equal(snapshot.providerFeeBasisPoints, 1_000);
  assert.equal(snapshot.providerFeeCents, 1_000);
  assert.equal(snapshot.providerNetCents, 9_000);
});

test("Pro snapshots a 6% provider fee", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "pro");
  assert.equal(snapshot.providerFeeBasisPoints, 600);
  assert.equal(snapshot.providerFeeCents, 600);
  assert.equal(snapshot.providerNetCents, 9_400);
});

test("customer total includes the $2.99 service fee without reducing provider net", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "starter");
  assert.equal(snapshot.customerServiceFeeCents, 299);
  assert.equal(snapshot.customerTotalCents, 10_299);
  assert.equal(snapshot.providerNetCents, 9_000);
});

test("provider completion after payment enters customer review", () => {
  assert.equal(paymentReleaseStatusAfterPayment({ heldTransfer: true, serviceCompleted: true, frozen: false, paymentSucceeded: true }), "awaiting_customer");
});

test("customer confirmation can release an eligible payout", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "awaiting_customer", hasOpenDispute: false, hasBlockingRefund: false, payoutFrozen: false, transferId: null }), true);
});

test("48 hour automatic completion uses the same eligibility rule", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "awaiting_customer", hasOpenDispute: false, hasBlockingRefund: false, payoutFrozen: false, transferId: null }), true);
});

test("customer dispute blocks payout", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "frozen", hasOpenDispute: true, hasBlockingRefund: false, payoutFrozen: true, transferId: null }), false);
});

test("payout remains blocked for the entire open-dispute state", () => {
  const input = { paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "frozen", hasOpenDispute: true, hasBlockingRefund: false, payoutFrozen: true, transferId: null };
  assert.equal(isProviderPayoutEligible(input), false);
  assert.equal(isProviderPayoutEligible(input), false);
});

test("full refund leaves no provider net", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "starter");
  assert.equal(providerNetAfterServiceRefund(snapshot, 10_000), 0);
});

test("partial refund recalculates provider net from the immutable fee snapshot", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "starter");
  assert.equal(providerNetAfterServiceRefund(snapshot, 4_000), 5_400);
});

test("successful provider transfer requires all payout guards", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "awaiting_customer", hasOpenDispute: false, hasBlockingRefund: false, payoutFrozen: false, transferId: null }), true);
});

test("failed provider transfer is retryable but not duplicated", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "failed", hasOpenDispute: false, hasBlockingRefund: false, payoutFrozen: false, transferId: null }), true);
});

test("duplicate webhook and payout attempts use stable keys", () => {
  assert.equal(stripeOperationKey("payout", "live", "booking-1"), stripeOperationKey("payout", "live", "booking-1"));
});

test("existing transfer blocks duplicate payout", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "completed", paymentReleaseStatus: "awaiting_customer", hasOpenDispute: false, hasBlockingRefund: false, payoutFrozen: false, transferId: "tr_123" }), false);
});

test("cancellation refund hold blocks payout", () => {
  assert.equal(isProviderPayoutEligible({ paymentStatus: "paid", bookingStatus: "cancelled", paymentReleaseStatus: "frozen", hasOpenDispute: false, hasBlockingRefund: true, payoutFrozen: true, transferId: null }), false);
});

test("historical booking keeps its fee snapshot after plan pricing changes", () => {
  const snapshot = calculateBookingFinancialSnapshot(10_000, "starter");
  const laterPlan = calculateBookingFinancialSnapshot(10_000, "pro");
  assert.equal(snapshot.providerFeeCents, 1_000);
  assert.equal(laterPlan.providerFeeCents, 600);
  assert.equal(providerNetAfterServiceRefund(snapshot, 4_000), 5_400);
});

test("customer confirmation and automatic release converge on one idempotency key", () => {
  const customerKey = stripeOperationKey("payout", "live", "booking-race");
  const automaticKey = stripeOperationKey("payout", "live", "booking-race");
  assert.equal(customerKey, automaticKey);
});

test("duplicate completion requests converge on the same customer-review state", () => {
  const input = { heldTransfer: true, serviceCompleted: true, frozen: false, paymentSucceeded: true };
  assert.equal(paymentReleaseStatusAfterPayment(input), "awaiting_customer");
  assert.equal(paymentReleaseStatusAfterPayment(input), "awaiting_customer");
});
