import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

test("request matching is eligibility, area, availability, and payment aware", () => {
  const route = source("app/api/job-requests/route.ts");
  assert.match(route, /provider\.is_verified = true/);
  assert.match(route, /provider\.screening_status = 'passed'/);
  assert.match(route, /stripe_charges_enabled = true AND provider\.stripe_payouts_enabled = true/);
  assert.match(route, /account_restrictions/);
  assert.match(route, /provider_location_service_areas/);
  assert.match(route, /EXTRACT\(DOW FROM/);
  assert.match(route, /matched_provider_count/);
});

test("one request preserves its provider conversation and response lifecycle", () => {
  const migration = source("database/migrations/063_marketplace_request_loop.sql");
  const route = source("app/api/job-requests/route.ts");
  const action = source("app/api/job-requests/[requestId]/route.ts");
  const quote = source("app/api/job-requests/[requestId]/quotes/route.ts");
  assert.match(migration, /conversation_id uuid REFERENCES conversations/);
  assert.match(migration, /viewed_at timestamptz/);
  assert.match(migration, /responded_at timestamptz/);
  assert.match(migration, /dismissed_at timestamptz/);
  assert.match(route, /RETURNING id::text/);
  assert.match(action, /body\.action === "view"/);
  assert.match(action, /body\.action === "dismiss"/);
  assert.match(quote, /responded_at = COALESCE\(responded_at, now\(\)\)/);
});

test("provider opportunity email delivery is queued, retryable, and preference aware", () => {
  const migration = source("database/migrations/063_marketplace_request_loop.sql");
  const operations = source("lib/job-request-operations.ts");
  const cron = source("app/api/cron/payment-releases/route.ts");
  assert.match(migration, /job_request_notification_queue/);
  assert.match(migration, /dedupe_key text NOT NULL UNIQUE/);
  assert.match(operations, /FOR UPDATE SKIP LOCKED/);
  assert.match(operations, /opportunity_notifications/);
  assert.match(operations, /attempts >= 5/);
  assert.match(cron, /processJobRequestNotificationQueue/);
});

test("stale requests expire and no longer leave sent quotes actionable", () => {
  const operations = source("lib/job-request-operations.ts");
  assert.match(operations, /SET status = 'expired'/);
  assert.match(operations, /expires_at <= now\(\)/);
  assert.match(operations, /UPDATE quotes SET status = 'expired'/);
  assert.match(operations, /job-request-expired-/);
});

test("customers compare provider trust, profile, messages, and price before accepting", () => {
  const api = source("app/api/job-requests/route.ts");
  const center = source("components/job-request-center.tsx");
  assert.match(api, /average_rating/);
  assert.match(api, /review_count/);
  assert.match(api, /publicProfileHref/);
  assert.match(center, /View provider profile/);
  assert.match(center, /Message provider/);
  assert.match(center, /Accept quote/);
  assert.match(center, /Not interested/);
});

test("search context, notification controls, and admin trace are connected", () => {
  const requestsPage = source("app/requests/page.tsx");
  const servicesPage = source("app/services/page.tsx");
  const settings = source("app/account/settings/settings-form.tsx");
  const admin = source("app/admin/requests/page.tsx");
  assert.match(requestsPage, /params\.location/);
  assert.match(servicesPage, /\.\.\.\(location \? \{ location \} : \{\}\)/);
  assert.match(settings, /Service-request responses/);
  assert.match(settings, /Matched opportunities/);
  assert.match(admin, /Exact addresses and customer contact details are not shown/);
  assert.match(admin, /job_request_notification_queue/);
});
