import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isAtLeastEighteen } from "../lib/age-eligibility.ts";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("provider document age verification uses calendar eligibility without persisting a DOB", () => {
  const boundary = new Date("2026-10-13T12:00:00.000Z");
  assert.equal(isAtLeastEighteen("2008-10-13", boundary), true);
  assert.equal(isAtLeastEighteen("2008-10-14", boundary), false);

  const verification = read("lib/provider-age-verification.ts");
  assert.match(verification, /identity\.verificationSessions\.retrieve\(sessionId, \{ expand: \["verified_outputs"\] \}\)/);
  assert.match(verification, /if \(dob && isAtLeastEighteen\(dob\)\)/);
  assert.match(verification, /never persisted or logged/);
  assert.doesNotMatch(verification, /INSERT INTO .*date_of_birth/i);
});

test("Stripe Connect readiness is separate from provider age verification and Stripe webhooks reconcile Identity", () => {
  const status = read("app/api/stripe/status/route.ts");
  const webhook = read("app/api/stripe/webhook/route.ts");
  const migration = read("database/migrations/082_provider_age_verification.sql");
  const providerRoute = read("app/api/stripe/provider-age-verification/route.ts");

  assert.match(status, /ageVerification: \{ status: provider\.age_verification_status \}/);
  assert.match(webhook, /identity\.verification_session\.verified/);
  assert.match(webhook, /syncProviderAgeVerificationFromStripe/);
  assert.match(migration, /age_verification_status/);
  assert.match(migration, /stripe_identity_verification_session_id/);
  assert.match(providerRoute, /isStripeReady\(\)/);
  assert.match(providerRoute, /provider-age-verification/);
});

test("provider verification can never leave the Stripe handoff button stuck", () => {
  const billing = read("components/billing-panel.tsx");
  const providerRoute = read("app/api/stripe/provider-age-verification/route.ts");

  assert.match(billing, /const result = await response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(billing, /We could not open Stripe right now/);
  assert.match(billing, /finally \{\s*window\.clearTimeout\(timeout\);\s*setWorking\(""\);/);
  assert.match(billing, /window\.location\.assign\(result\.url\)/);
  assert.match(billing, /<form action="\/api\/stripe\/provider-age-verification" method="post"/);
  assert.match(providerRoute, /NextResponse\.redirect\(result\.url, 303\)/);
  assert.match(providerRoute, /age-verification-error/);
});

test("unverified providers are blocked from public listings, booking acceptance, checkout, and transfers", () => {
  const marketplace = read("lib/marketplace.ts");
  const booking = read("app/api/bookings/route.ts");
  const providerBooking = read("app/api/providers/bookings/[bookingId]/route.ts");
  const checkout = read("app/api/stripe/bookings/[bookingId]/checkout/route.ts");
  const payout = read("lib/payment-release.ts");
  const tip = read("lib/tip-payments.ts");

  assert.match(marketplace, /p\.age_verification_status = 'verified'/);
  assert.match(booking, /p\.age_verification_status = 'verified'/);
  assert.match(providerBooking, /Complete provider age verification before accepting/);
  assert.match(checkout, /booking\.age_verification_status !== "verified"/);
  assert.match(payout, /p\.age_verification_status = 'verified'/);
  assert.match(tip, /provider\.age_verification_status='verified'/);
});

test("admin listing status reflects public eligibility and cannot restore an unverified provider", () => {
  const admin = read("app/api/admin/route.ts");
  const dashboard = read("components/admin-dashboard.tsx");
  const preview = read("app/admin/listings/[serviceId]/page.tsx");

  assert.match(admin, /p\.age_verification_status = 'verified'/);
  assert.match(admin, /This listing cannot be made public until its provider completes required age verification/);
  assert.match(dashboard, /verification required/);
  assert.match(preview, /remains off the public marketplace until the provider completes required age verification/);
});

test("only profiles that existed before the policy can receive a documented admin exception", () => {
  const migration = read("database/migrations/084_legacy_provider_age_exceptions.sql");
  const admin = read("app/api/admin/route.ts");
  const dashboard = read("components/admin-dashboard.tsx");
  const verification = read("lib/provider-age-verification.ts");

  assert.match(migration, /age_verification_exception_eligible boolean NOT NULL DEFAULT false/);
  assert.match(migration, /UPDATE provider_profiles[\s\S]*age_verification_status <> 'verified'/);
  assert.match(admin, /Only provider profiles that existed before this exception policy may receive an admin exception/);
  assert.match(admin, /provider_age_exception_approved/);
  assert.match(admin, /provider_age_exception_revoked/);
  assert.match(admin, /read_at=NULL/);
  assert.doesNotMatch(admin, /is_read=false/);
  assert.match(dashboard, /Approve legacy exception/);
  assert.match(dashboard, /Revoke exception/);
  assert.match(dashboard, /legacy-provider-exception-note/);
  assert.match(dashboard, /Confirm approval/);
  const ageExceptionFlow = dashboard.slice(dashboard.indexOf("function beginAgeException"), dashboard.indexOf("return <div", dashboard.indexOf("function beginAgeException")));
  assert.doesNotMatch(ageExceptionFlow, /window\.prompt\(/);
  assert.match(verification, /age_verification_source === "admin_exception"/);
});
