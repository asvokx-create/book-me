import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path:string){return readFileSync(new URL(path,import.meta.url),"utf8");}

test("commerce migration preserves per-occurrence and immutable selection snapshots",()=>{
  const migration=source("../database/migrations/070_service_commerce_foundation.sql");
  assert.match(migration,/CREATE TABLE IF NOT EXISTS recurring_booking_series/);
  assert.match(migration,/package_snapshot jsonb/);
  assert.match(migration,/add_on_snapshot jsonb/);
  assert.match(migration,/price_cents = GREATEST\(0, base_price_cents \+ add_on_total_cents - discount_cents\)/);
  assert.match(migration,/UNIQUE INDEX IF NOT EXISTS bookings_recurring_occurrence_key/);
});

test("recurrence generates independent unpaid booking records and never silently charges a saved card",()=>{
  const generator=source("../lib/recurring-bookings.ts");
  const webhook=source("../app/api/stripe/webhook/route.ts");
  const bookingUi=source("../app/services/[slug]/booking-card.tsx");
  assert.match(generator,/INSERT INTO bookings/);
  assert.match(generator,/Payment is handled separately/);
  assert.doesNotMatch(generator,/paymentIntents\.create|subscriptions\.create/);
  assert.match(webhook,/recurring_booking_series SET status = 'paused'/);
  assert.match(webhook,/Recurring plan paused/);
  assert.match(bookingUi,/separate booking and payment records/);
});

test("repeat offers require a completed relationship, stay in messages, and enforce cooldowns",()=>{
  const route=source("../app/api/providers/customers/route.ts");
  assert.match(route,/booking\.status='completed'/);
  assert.match(route,/provider_repeat_offers/);
  assert.match(route,/interval '30 days'/);
  assert.match(route,/INSERT INTO messages/);
  assert.match(route,/limit:3,windowSeconds:3600/);
});

test("normal provider marketing links remain separate from partner attribution",()=>{
  const marketing=source("../components/provider-marketing-tools.tsx");
  assert.match(marketing,/https:\/\/bubsbookings\.com/);
  assert.doesNotMatch(marketing,/affiliate|referral|affiliate_code/);
});

test("coupon discounts are provider funded and customer fee remains explicit",()=>{
  const coupons=source("../components/provider-coupon-manager.tsx");
  const checkout=source("../app/api/stripe/bookings/[bookingId]/checkout/route.ts");
  assert.match(coupons,/Provider-funded discounts reduce the service subtotal and the marketplace-fee basis/);
  assert.match(coupons,/separate \$2\.99 customer service fee does not change/);
  assert.match(checkout,/BubsBookings service fee/);
});

test("new provider commerce copy participates in the listing safety scan",()=>{
  const route=source("../app/api/providers/services/[serviceId]/route.ts");
  assert.match(route,/preparationNotes, \.\.\.packages\.flatMap/);
  assert.match(route,/\.\.\.addOns\.flatMap/);
});

test("outside-client recommendations are one-time, moderated, and never presented as verified reviews",()=>{
  const migration=source("../database/migrations/070_service_commerce_foundation.sql");
  const submit=source("../app/api/recommendations/submit/route.ts");
  const profile=source("../app/providers/[slug]/page.tsx");
  assert.match(migration,/token_hash text NOT NULL UNIQUE/);
  assert.match(migration,/moderation_status IN \('pending','approved','hidden','rejected'\)/);
  assert.match(submit,/Providers cannot submit recommendations for themselves/);
  assert.match(submit,/SET used_at=now\(\).*used_at IS NULL/);
  assert.match(profile,/not verified booking reviews/);
  assert.match(profile,/Client Recommendations/);
});
