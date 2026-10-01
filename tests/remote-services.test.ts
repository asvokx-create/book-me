import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { serviceMatchesRequest, serviceSupportsMethod } from "../lib/service-delivery.ts";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("delivery compatibility is explicit and never treats remote-only work as local", () => {
  assert.equal(serviceSupportsMethod("REMOTE", "REMOTE"), true);
  assert.equal(serviceSupportsMethod("REMOTE", "IN_PERSON"), false);
  assert.equal(serviceSupportsMethod("BOTH", "REMOTE"), true);
  assert.equal(serviceSupportsMethod("BOTH", "IN_PERSON"), true);
  assert.equal(serviceMatchesRequest("IN_PERSON", "REMOTE"), false);
  assert.equal(serviceMatchesRequest("REMOTE", "EITHER"), true);
});

test("the migration safely defaults existing records and snapshots booking delivery", () => {
  const migration = source("database/migrations/066_service_delivery_types.sql");
  assert.match(migration, /delivery_type text NOT NULL DEFAULT 'IN_PERSON'/);
  assert.match(migration, /location_id DROP NOT NULL/);
  assert.match(migration, /bookings[\s\S]*delivery_method text NOT NULL DEFAULT 'IN_PERSON'/);
  assert.match(migration, /job_requests[\s\S]*delivery_type IN \('IN_PERSON', 'REMOTE', 'EITHER'\)/);
  assert.match(migration, /service_address_line1 DROP NOT NULL/);
});

test("remote discovery bypasses distance without leaking location into URLs", () => {
  const marketplace = source("lib/marketplace.ts");
  const services = source("app/services/page.tsx");
  assert.match(marketplace, /service\.deliveryType === "REMOTE"/);
  assert.match(marketplace, /service\.deliveryType === "BOTH"/);
  assert.match(marketplace, /delivery === "REMOTE"/);
  assert.match(services, /delivery !== "REMOTE" && location/);
  assert.match(services, /Available online/);
  assert.match(services, /remote providers, prices, and availability without a distance limit/i);
});

test("remote bookings and requests do not require a physical address", () => {
  const booking = source("app/api/bookings/route.ts");
  const bookingCard = source("app/services/[slug]/booking-card.tsx");
  const jobs = source("app/api/job-requests/route.ts");
  const jobForm = source("components/post-job-form.tsx");
  assert.match(booking, /isRemote \? "Remote service"/);
  assert.match(booking, /delivery_method/);
  assert.match(bookingCard, /deliveryMethod !== "REMOTE"/);
  assert.match(jobs, /requiresLocation = deliveryType !== "REMOTE"/);
  assert.match(jobForm, /deliveryType !== "REMOTE"/);
  assert.match(jobForm, /do not collect or expose your street address/);
});

test("remote and local workflows continue through quotes, payments, and affiliate-neutral bookings", () => {
  const quoteCreate = source("app/api/job-requests/[requestId]/quotes/route.ts");
  const quoteAccept = source("app/api/quotes/[quoteId]/route.ts");
  const quoteForm = source("components/job-request-center.tsx");
  const affiliateRules = source("lib/affiliate-rules.ts");
  assert.match(quoteCreate, /delivery_method/);
  assert.match(quoteCreate, /serviceSupportsMethod/);
  assert.match(quoteCreate, /Choose a delivery method supported by both the request and service/);
  assert.match(quoteForm, /How will you deliver this quote/);
  assert.match(quoteAccept, /quote\.delivery_method === "REMOTE" \? "Remote service"/);
  assert.match(quoteAccept, /calculateBookingFinancialSnapshot/);
  assert.doesNotMatch(affiliateRules, /delivery_type|delivery_method/);
});

test("local SEO pages exclude remote-only listings while the sitemap keeps every public listing", () => {
  assert.match(source("app/locations/page.tsx"), /delivery: "IN_PERSON"/);
  assert.match(source("app/locations/[city]/page.tsx"), /delivery: "IN_PERSON"/);
  assert.match(source("app/locations/[city]/[category]/page.tsx"), /delivery: "IN_PERSON"/);
  assert.match(source("app/sitemap.ts"), /getServices\(\{ limit: 1000 \}\)/);
});
