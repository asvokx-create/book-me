import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { formatServicePrice, isPricingType } from "../lib/service-pricing.ts";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("quote-only is an explicit pricing mode with no numeric public price", () => {
  assert.equal(isPricingType("QUOTE_ONLY"), true);
  assert.equal(formatServicePrice({ pricingType: "QUOTE_ONLY", price: 999, hourlyRateCents: null }), "Request a Quote");

  const migration = read("database", "migrations", "103_quote_only_listings.sql");
  assert.match(migration, /pricing_type IN \('FIXED', 'HOURLY', 'QUOTE_ONLY'\)/);
  assert.match(migration, /pricing_type_snapshot IN \('FIXED', 'HOURLY', 'QUOTE_ONLY'\)/);
});

test("listing creation and editing expose the custom quote toggle without requiring a price", () => {
  const onboarding = read("app", "providers", "join", "onboarding-form.tsx");
  const onboardingApi = read("app", "api", "providers", "onboarding", "route.ts");
  const editor = read("app", "provider", "services", "[serviceId]", "edit", "listing-editor.tsx");
  const editorApi = read("app", "api", "providers", "services", "[serviceId]", "route.ts");

  for (const source of [onboarding, editor]) {
    assert.match(source, /Custom Quote Only/);
    assert.match(source, /Customers will contact you for a personalized quote instead of booking at a fixed price\./);
    assert.match(source, /pricingType === "QUOTE_ONLY"/);
  }
  assert.match(onboardingApi, /pricingType === "QUOTE_ONLY" \? 0/);
  assert.match(editorApi, /pricingType === "QUOTE_ONLY"\) effectivePriceCents = ownership\.rows\[0\]\.current_price_cents/);
});

test("quote-only listings use consistent public labels and omit numeric SEO prices", () => {
  const search = read("app", "services", "page.tsx");
  const company = read("app", "companies", "[slug]", "page.tsx");
  const provider = read("app", "providers", "[slug]", "page.tsx");
  const detail = read("app", "services", "[slug]", "page.tsx");

  for (const source of [search, company, provider, detail]) {
    assert.match(source, /Custom Quote|Request a Quote/);
  }
  assert.match(provider, /service\.pricingType === "QUOTE_ONLY" \? \{\} : \{ priceCurrency/);
  assert.match(detail, /service\.pricingType === "QUOTE_ONLY" \? \{\} : \{ offers/);
  assert.match(detail, /price=\{service\.pricingType === "QUOTE_ONLY" \? 0 : service\.price\}/);
  assert.match(detail, /packages=\{service\.pricingType === "QUOTE_ONLY" \? \[\] : service\.packages\}/);
});

test("quote requests reject fixed-price selections and duplicate open requests", () => {
  const bookingApi = read("app", "api", "bookings", "route.ts");
  const bookingCard = read("app", "services", "[slug]", "booking-card.tsx");

  assert.match(bookingApi, /Quote-only services cannot use fixed-price booking options before a quote is accepted/);
  assert.match(bookingApi, /Describe what you need so the provider can prepare an accurate quote/);
  assert.match(bookingApi, /You already have an open quote request for this service/);
  assert.match(bookingCard, /quoteOnly \? null : packageId/);
  assert.match(bookingCard, /quoteOnly \? \[\] : Object\.entries\(addOnQuantities\)/);
  assert.match(bookingCard, /quoteOnly \? "Request a Quote"/);
});

test("quote-only checkout requires an accepted server-side quote", () => {
  const providerBooking = read("app", "api", "providers", "bookings", "[bookingId]", "route.ts");
  const checkout = read("app", "api", "stripe", "bookings", "[bookingId]", "checkout", "route.ts");
  const bookingDetails = read("components", "booking-details.tsx");

  assert.match(providerBooking, /Send a custom quote and wait for the customer to accept it before confirming this request/);
  assert.match(providerBooking, /booking\.pricing_type_snapshot === "HOURLY" \? "HOURLY" : "FIXED"/);
  assert.match(checkout, /pricing_type_snapshot === "QUOTE_ONLY"/);
  assert.match(checkout, /Accept the provider's custom quote before checkout/);
  assert.match(bookingDetails, /booking\.pricing\.type === "QUOTE_ONLY" && booking\.quote\.status !== "accepted"/);
});

test("numeric maximum-price filters exclude quote-only listings", () => {
  const marketplace = read("lib", "marketplace.ts");
  assert.match(marketplace, /s\.pricing_type <> 'QUOTE_ONLY'/);
  assert.match(marketplace, /WHEN s\.pricing_type='QUOTE_ONLY' THEN NULL/);
});
