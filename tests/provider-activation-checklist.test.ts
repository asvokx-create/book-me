import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ageActivationStep, listingInactiveReasons, payoutActivationStep } from "../lib/provider-activation.ts";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("listing visibility reports every authoritative blocking reason", () => {
  assert.deepEqual(listingInactiveReasons({
    isActive: false,
    ageVerificationBlocked: true,
    providerIsActive: true,
    companyIsActive: true,
    ageVerificationStatus: "not_started",
  }), ["Your listing isn’t public yet because you need to complete age verification."]);
  assert.equal(listingInactiveReasons({
    isActive: true,
    ageVerificationBlocked: false,
    providerIsActive: true,
    companyIsActive: true,
    ageVerificationStatus: "verified",
  }).length, 0);
  assert.equal(listingInactiveReasons({
    isActive: false,
    ageVerificationBlocked: false,
    providerIsActive: false,
    companyIsActive: false,
    ageVerificationStatus: "failed",
  }).length, 4);
});

test("age and payout setup map to clear progress states", () => {
  assert.equal(ageActivationStep("not_started").status, "not_started");
  assert.equal(ageActivationStep("pending").status, "under_review");
  assert.equal(ageActivationStep("requires_input").status, "action_required");
  assert.equal(ageActivationStep("failed").status, "failed");
  assert.equal(ageActivationStep("verified").status, "completed");
  assert.equal(payoutActivationStep("not_connected").status, "not_started");
  assert.equal(payoutActivationStep("under_review").status, "under_review");
  assert.equal(payoutActivationStep("ready").status, "completed");
});

test("provider activation data comes from owner-authorized server records", async () => {
  const [route, component] = await Promise.all([
    read("app/api/providers/me/route.ts"),
    read("components/provider-activation-checklist.tsx"),
  ]);
  assert.match(route, /getProviderAccess/);
  assert.match(route, /service\.provider_id::text=\$1/);
  assert.match(route, /company\.id=service\.company_id AND company\.is_active=true/);
  assert.match(route, /service\.provider_deleted_at IS NULL/);
  assert.match(route, /service\.is_active=true OR service\.age_verification_blocked=true/);
  assert.match(route, /age_verification_status/);
  assert.match(route, /publicListingCount/);
  assert.match(component, /Get Your Business Ready/);
  assert.match(component, /if \(!stripe && !statusUnavailable\) return null/);
  assert.match(component, /if \(allComplete\) return null/);
  assert.doesNotMatch(component, /showWhenComplete/);
  assert.match(component, /\/api\/stripe\/provider-age-verification/);
  assert.match(component, /\/api\/stripe\/connect/);
  assert.match(component, /Stripe payout setup is required to receive earnings\. It does not determine whether a listing is public/);
  assert.doesNotMatch(component, /dismiss|localStorage/);
});

test("verified providers do not have newly created services age-blocked again", async () => {
  const onboarding = await read("app/api/providers/onboarding/route.ts");
  assert.match(onboarding, /age_verification_status FROM provider_profiles/);
  assert.match(onboarding, /listingAgeVerified = existing\?\.age_verification_status === "verified"/);
  assert.match(onboarding, /listingAgeVerified, !listingAgeVerified/);
});

test("admin listing visibility shows all statuses without adding Stripe as a publication gate", async () => {
  const [route, dashboard, preview, marketplace] = await Promise.all([
    read("app/api/admin/route.ts"),
    read("components/admin-dashboard.tsx"),
    read("app/admin/listings/[serviceId]/page.tsx"),
    read("lib/marketplace.ts"),
  ]);
  assert.match(route, /safety_review_status/);
  assert.match(route, /last_status_update/);
  assert.match(dashboard, /Age verification/);
  assert.match(dashboard, /Stripe payouts/);
  assert.match(dashboard, /Safety review/);
  assert.match(preview, /Stripe payout setup is required to receive earnings, but it does not control listing publication/);
  assert.match(marketplace, /p\.age_verification_status = 'verified'/);
  assert.doesNotMatch(marketplace, /stripe_payouts_enabled/);
});

test("provider welcome points to the activation checklist without changing one-time delivery", async () => {
  const email = await read("lib/provider-welcome-email.ts");
  assert.match(email, /Finish Your Provider Activation/);
  assert.match(email, /Review Activation Checklist/);
  assert.match(email, /\/provider\/dashboard#activation-checklist/);
  assert.match(email, /ON CONFLICT \(user_id\) DO NOTHING/);
});
