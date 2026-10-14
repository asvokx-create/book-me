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
