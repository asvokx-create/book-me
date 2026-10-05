import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("booking creation calculates hourly labor on the server and snapshots every rule", async () => {
  const route = await read("app/api/bookings/route.ts");
  assert.match(route, /validateHourlyDuration/);
  assert.match(route, /calculateHourlyBasePriceCents/);
  assert.doesNotMatch(route, /body\.price/);
  assert.match(route, /pricing_type_snapshot,hourly_rate_cents_snapshot,billable_duration_minutes,billing_increment_minutes_snapshot,minimum_duration_minutes_snapshot,maximum_duration_minutes_snapshot/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /selectedDurationMinutes = billableDurationMinutes \+ commerce\.selectedAddOns/);
});

test("availability and accepted quotes reserve their authoritative full duration", async () => {
  const availability = await read("app/api/services/[serviceId]/availability/route.ts");
  const quote = await read("app/api/quotes/[quoteId]/route.ts");
  const directQuote = await read("app/api/bookings/[bookingId]/route.ts");
  assert.match(availability, /validateHourlyDuration/);
  assert.match(availability, /selectedDurationMinutes \+= additionalMinutes/);
  assert.match(availability, /make_interval\(mins => gs\.duration_minutes\)/);
  assert.match(quote, /unavailableBookingProfessionals/);
  assert.match(quote, /billing_increment_minutes_snapshot,minimum_duration_minutes_snapshot,maximum_duration_minutes_snapshot/);
  assert.match(directQuote, /quotedDuration \+ addOnMinutes/);
});

test("checkout freezes hourly rate and duration instead of reading the current listing price", async () => {
  const checkout = await read("app/api/stripe/bookings/[bookingId]/checkout/route.ts");
  assert.match(checkout, /b\.pricing_type_snapshot,b\.hourly_rate_cents_snapshot,b\.billable_duration_minutes/);
  assert.match(checkout, /booking\.hourly_rate_cents_snapshot/);
  assert.match(checkout, /pricingType: booking\.pricing_type_snapshot/);
  assert.match(checkout, /billableDurationMinutes: String\(booking\.billable_duration_minutes\)/);
});

test("hourly modifications require the other party and preserve an audit record", async () => {
  const changes = await read("app/api/bookings/[bookingId]/changes/route.ts");
  assert.match(changes, /booking_change_requests/);
  assert.match(changes, /The other party must approve this change/);
  assert.match(changes, /unavailableBookingProfessionals/);
  assert.match(changes, /duration_change_approved/);
  assert.match(changes, /payment_status !== "unpaid"/);
});

test("hourly quotes, recurring occurrences, CRM, analytics, and legal copy use pricing snapshots", async () => {
  const serviceQuotes = await read("app/api/job-requests/[requestId]/quotes/route.ts");
  const recurring = await read("lib/recurring-bookings.ts");
  const crm = await read("app/api/providers/clients/route.ts");
  const analytics = await read("app/api/providers/revenue/route.ts");
  const terms = await read("app/terms/page.tsx");
  assert.match(serviceQuotes, /calculateHourlyBasePriceCents/);
  assert.match(recurring, /hourly_rate_cents_snapshot/);
  assert.match(crm, /billable_duration_minutes/);
  assert.match(analytics, /bookedHours/);
  assert.match(terms, /approved duration is separate from any actual clock time/);
});
