import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("coupon administration is owner-only, plan-gated, bounded, and rejects contradictory audiences", async()=>{
  const route=await read("app/api/providers/coupons/route.ts");
  assert.match(route,/!access\.isOwner/);
  assert.match(route,/Provider coupons require Pro/);
  assert.match(route,/body\.isActive === true/);
  assert.match(route,/firstBookingOnly === true && body\.repeatCustomerOnly === true/);
  assert.match(route,/\^\[A-Z0-9_-\]\{3,32\}\$/);
  assert.match(route,/usageLimit > 100000/);
  assert.match(route,/provider_id::text=\$2/);
  assert.match(route,/export async function DELETE/);
  assert.match(route,/DELETE FROM provider_coupons WHERE id::text=\$1 AND provider_id::text=\$2/);
});

test("customer coupon preview is authenticated, rate-limited, scoped, and financially explicit", async()=>{
  const route=await read("app/api/coupons/validate/route.ts");
  assert.match(route,/Log in to apply a coupon/);
  assert.match(route,/coupon-validate/);
  assert.match(route,/provider_id::text=\$1 AND upper\(code\)=\$2 AND is_active=true/);
  assert.match(route,/service_id IS NULL OR service_id::text=\$3/);
  assert.match(route,/first-time customers/);
  assert.match(route,/returning customers/);
  assert.match(route,/customerServiceFeeCents: DEFAULT_CUSTOMER_SERVICE_FEE_CENTS/);
  assert.match(route,/customerTotalCents/);
});

test("booking creation independently revalidates entitlement and atomically reserves limited coupons", async()=>{
  const route=await read("app/api/bookings/route.ts");
  assert.match(route,/PLAN_ENTITLEMENTS\[service\.plan\]\.promotions/);
  assert.match(route,/UPDATE provider_coupons coupon SET redemption_count=coupon\.redemption_count\+1/);
  assert.match(route,/redemption_count<coupon\.usage_limit/);
  assert.match(route,/provider\.plan IN \('pro','business','owner'\)/);
  assert.match(route,/discount_cents/);
  assert.match(route,/coupon_code_snapshot/);
  assert.match(route,/customerServiceFeeCents: financialSnapshot\.customerServiceFeeCents/);
});

test("the customer UI applies coupons before submission and shows every pricing layer", async()=>{
  const card=await read("app/services/[slug]/booking-card.tsx");
  assert.match(card,/\/api\/coupons\/validate/);
  assert.match(card,/"Checking…":"Apply"/);
  assert.match(card,/Service before coupon/);
  assert.match(card,/Coupon savings/);
  assert.match(card,/BubsBookings service fee/);
  assert.match(card,/Total after confirmation/);
  assert.match(card,/setConfirmedPricing\(data\.pricing/);
  assert.match(card,/response\.json\(\)\.catch\(\(\) => null\)/);
});

test("checkout charges the discounted snapshot plus the separate service fee", async()=>{
  const checkout=await read("app/api/stripe/bookings/[bookingId]/checkout/route.ts");
  assert.match(checkout,/booking\.price_cents/);
  assert.match(checkout,/booking\.customer_service_fee_cents/);
  assert.match(checkout,/coupon_code_snapshot/);
  assert.match(checkout,/coupon_code_snapshot \? `\$\{booking\.coupon_code_snapshot\} `/);
});

test("refund and recurring paths preserve coupon accounting boundaries", async()=>{
  const refund=await read("app/api/bookings/[bookingId]/refund/route.ts");
  const recurring=await read("lib/recurring-bookings.ts");
  assert.match(refund,/booking\.price_cents/);
  assert.match(refund,/remainingRefundable = booking\.price_cents - booking\.refunded_amount_cents/);
  assert.match(recurring,/discount_cents/);
  assert.doesNotMatch(recurring,/coupon_id/);
});

test("provider coupon controls recover from network and non-JSON failures", async()=>{
  const manager=await read("components/provider-coupon-manager.tsx");
  assert.match(manager,/response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(manager,/Check your connection and try again/);
  assert.match(manager,/finally\s*\{\s*setWorking\(false\);/);
  assert.match(manager,/disabled=\{working\}/);
  assert.match(manager,/method: "DELETE"/);
  assert.match(manager,/Past bookings keep their recorded discount details/);
  assert.match(manager,/CustomSelect/);
  assert.doesNotMatch(manager,/<select/);
});
