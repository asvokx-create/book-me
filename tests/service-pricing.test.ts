import test from "node:test";
import assert from "node:assert/strict";
import { calculateHourlyBasePriceCents, calculateServiceBasePriceCents, hourlyDurationOptions, validateHourlyDuration, type HourlyPricingConfig } from "../lib/service-pricing.ts";
import { calculateCommerceSelection, type CouponRule, type ServiceAddOn } from "../lib/service-commerce.ts";
import { calculateBookingFinancialSnapshot, providerNetAfterServiceRefund } from "../lib/booking-financials.ts";

const hourly = (overrides: Partial<HourlyPricingConfig> = {}): HourlyPricingConfig => ({
  pricingType: "HOURLY", hourlyRateCents: 5_000, minimumDurationMinutes: 120,
  maximumDurationMinutes: 480, billingIncrementMinutes: 30, defaultDurationMinutes: 120, ...overrides,
});

test("hourly money uses exact cent calculations", () => {
  assert.equal(calculateHourlyBasePriceCents(5_000, 120), 10_000);
  assert.equal(calculateHourlyBasePriceCents(5_000, 150), 12_500);
  assert.equal(calculateHourlyBasePriceCents(7_500, 30), 3_750);
  assert.equal(calculateHourlyBasePriceCents(9_900, 15), 2_475);
  assert.equal(calculateHourlyBasePriceCents(7_000, 210), 24_500);
});

test("hourly duration enforces minimum, maximum, and increment", () => {
  assert.equal(validateHourlyDuration(hourly(), 210), 210);
  assert.throws(() => validateHourlyDuration(hourly(), 90), /at least/);
  assert.throws(() => validateHourlyDuration(hourly(), 510), /no more than/);
  assert.throws(() => validateHourlyDuration(hourly(), 125), /30-minute/);
});

test("hourly config supports 15, 30, and 60 minute increments", () => {
  assert.equal(calculateServiceBasePriceCents(hourly({ minimumDurationMinutes: 15, defaultDurationMinutes: 15, billingIncrementMinutes: 15 }), 15), 1_250);
  assert.equal(calculateServiceBasePriceCents(hourly(), 150), 12_500);
  assert.equal(calculateServiceBasePriceCents(hourly({ minimumDurationMinutes: 60, defaultDurationMinutes: 60, billingIncrementMinutes: 60 }), 180), 15_000);
});

test("duration options are bounded and increment aligned", () => {
  assert.deepEqual(hourlyDurationOptions(hourly({ minimumDurationMinutes: 120, maximumDurationMinutes: 180 })), [120, 150, 180]);
});

test("hourly labor, add-ons, coupons, fees, payouts, and refunds compose from cents", () => {
  const addOn: ServiceAddOn = { id: "addon", name: "Supplies", description: "", priceCents: 2_000, additionalMinutes: 30, allowsQuantity: false, maxQuantity: 1 };
  const coupon: CouponRule = { id: "coupon", code: "SAVE10", discountType: "percentage", discountValue: 10, minimumSubtotalCents: 0, firstBookingOnly: false, repeatCustomerOnly: false, expiresAt: null, usageLimit: null, redemptionCount: 0 };
  const laborCents = calculateServiceBasePriceCents(hourly(), 150);
  const commerce = calculateCommerceSelection({ servicePriceCents: laborCents, addOns: [{ addOn, quantity: 1 }], coupon });
  const financials = calculateBookingFinancialSnapshot(commerce.serviceSubtotalCents, "starter");

  assert.deepEqual({ laborCents, original: commerce.originalSubtotalCents, discount: commerce.discountCents, subtotal: commerce.serviceSubtotalCents }, { laborCents: 12_500, original: 14_500, discount: 1_450, subtotal: 13_050 });
  assert.equal(financials.customerTotalCents, 13_349);
  assert.equal(financials.providerFeeCents, 1_305);
  assert.equal(financials.providerNetCents, 11_745);
  assert.equal(providerNetAfterServiceRefund(financials, 3_000), 9_045);
});
