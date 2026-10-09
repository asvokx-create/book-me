import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateBookingFinancialSnapshot } from "../lib/booking-financials.ts";
import { calculateHourlyBasePriceCents } from "../lib/service-pricing.ts";
import { maximumTipCents, requiresHighTipConfirmation, resolveTipSelection } from "../lib/tips.ts";

test("fixed-price tips are optional and are calculated only from the service subtotal", () => {
  const booking = calculateBookingFinancialSnapshot(10_000, "starter");
  const tip = resolveTipSelection({ type: "percentage", percentage: 20, serviceSubtotalCents: 10_000 });

  assert.deepEqual(tip, { type: "percentage", percentage: 20, amountCents: 2_000 });
  // A tip is intentionally absent from the booking financial snapshot: service
  // fees, customer fee, provider share, and Partner calculations stay unchanged.
  assert.deepEqual(booking, calculateBookingFinancialSnapshot(10_000, "starter"));
  assert.equal(booking.providerFeeCents, 1_000);
  assert.equal(booking.providerNetCents, 9_000);
  assert.throws(() => resolveTipSelection({ type: "none", serviceSubtotalCents: 10_000 }), /valid tip amount/);
});

test("hourly tips use the final hourly service subtotal, never the service fee", () => {
  const hourlyServiceSubtotal = calculateHourlyBasePriceCents(7_500, 120);
  const tip = resolveTipSelection({ type: "percentage", percentage: 15, serviceSubtotalCents: hourlyServiceSubtotal });

  assert.equal(hourlyServiceSubtotal, 15_000);
  assert.deepEqual(tip, { type: "percentage", percentage: 15, amountCents: 2_250 });
  assert.equal(calculateBookingFinancialSnapshot(hourlyServiceSubtotal, "pro").customerServiceFeeCents, 299);
  assert.equal(tip.amountCents, 2_250);
});

test("custom tips are validated in cents with bounds and an explicit high-value confirmation", () => {
  assert.deepEqual(resolveTipSelection({ type: "custom", amountCents: 501, serviceSubtotalCents: 8_500 }), { type: "custom", percentage: null, amountCents: 501 });
  assert.equal(maximumTipCents(8_500), 8_500);
  assert.throws(() => resolveTipSelection({ type: "custom", amountCents: 49, serviceSubtotalCents: 8_500 }), /at least/);
  assert.throws(() => resolveTipSelection({ type: "custom", amountCents: 8_501, serviceSubtotalCents: 8_500, highTipConfirmed: true }), /cannot exceed/);
  assert.equal(requiresHighTipConfirmation(4_251, 8_500), true);
  assert.throws(() => resolveTipSelection({ type: "custom", amountCents: 4_251, serviceSubtotalCents: 8_500 }), /Confirm/);
  assert.equal(resolveTipSelection({ type: "custom", amountCents: 4_251, serviceSubtotalCents: 8_500, highTipConfirmed: true }).amountCents, 4_251);
});

test("tip payment code keeps the ledger, Checkout payment, and Connect transfer separate", () => {
  const migration = readFileSync("database/migrations/080_customer_tips.sql", "utf8");
  const checkout = readFileSync("app/api/stripe/bookings/[bookingId]/tip/checkout/route.ts", "utf8");
  const payments = readFileSync("lib/tip-payments.ts", "utf8");
  const webhooks = readFileSync("app/api/stripe/webhook/route.ts", "utf8");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS booking_tips/);
  assert.match(migration, /booking_id uuid NOT NULL UNIQUE/);
  assert.match(checkout, /booking\.payment_flow !== "held_transfer_v1"/);
  assert.match(checkout, /tip-checkout-\$\{mode\}-\$\{tip\.id\}-\$\{tip\.attemptNumber\}/);
  assert.match(checkout, /kind: "booking_tip"/);
  assert.match(payments, /source_transaction: tip\.stripe_charge_id/);
  assert.match(payments, /booking_tip_payout/);
  assert.match(webhooks, /charge\.refunded/);
  assert.match(webhooks, /charge\.dispute\.created/);
  assert.match(webhooks, /booking_tip_dispute_reversal/);
});
