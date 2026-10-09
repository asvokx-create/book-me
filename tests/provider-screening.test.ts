import assert from "node:assert/strict";
import test from "node:test";

import { hasOffPlatformPaymentInstruction } from "../lib/provider-screening-rules.ts";

test("provider screening allows legitimate gift-card offerings", () => {
  assert.equal(hasOffPlatformPaymentInstruction("Gift cards are available for birthdays and special occasions."), false);
  assert.equal(hasOffPlatformPaymentInstruction("Ask us about gift card packages for your next visit."), false);
});

test("provider screening still blocks off-platform payment instructions", () => {
  assert.equal(hasOffPlatformPaymentInstruction("Pay with gift cards to reserve your appointment."), true);
  assert.equal(hasOffPlatformPaymentInstruction("Cash App only."), true);
  assert.equal(hasOffPlatformPaymentInstruction("Guaranteed income from every booking."), true);
});
