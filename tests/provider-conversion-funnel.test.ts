import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildProviderAuthHref, buildProviderJoinDestination } from "../lib/provider-acquisition.ts";

test("provider referral and UTM parameters survive signup and OAuth return navigation", () => {
  const destination = buildProviderJoinDestination({
    plan: "starter",
    ref: "prestonlee",
    utm_source: "affiliate",
    utm_campaign: "millo_oct_nov_2026",
    utm_content: "above_content",
  });
  assert.equal(destination.plan, "starter");
  assert.match(destination.returnPath, /^\/providers\/join\?/);
  assert.equal(new URL(destination.returnPath, "https://bubsbookings.com").searchParams.get("ref"), "PRESTONLEE");
  assert.equal(new URL(destination.returnPath, "https://bubsbookings.com").searchParams.get("utm_source"), "affiliate");

  const signup = new URL(buildProviderAuthHref("/signup", destination.returnPath, destination.preserved), "https://bubsbookings.com");
  assert.equal(signup.searchParams.get("ref"), "PRESTONLEE");
  assert.equal(signup.searchParams.get("utm_campaign"), "millo_oct_nov_2026");
  assert.equal(signup.searchParams.get("redirect"), destination.returnPath);
});

test("provider destination rejects unsafe referral codes and unsupported parameters", () => {
  const destination = buildProviderJoinDestination({
    plan: "not-a-plan",
    ref: "https://malicious.example/<script>",
    password: "must-not-survive",
    utm_source: "affiliate",
  });
  const parsed = new URL(destination.returnPath, "https://bubsbookings.com");
  assert.equal(destination.plan, "");
  assert.equal(parsed.searchParams.get("ref"), null);
  assert.equal(parsed.searchParams.get("password"), null);
  assert.equal(parsed.searchParams.get("utm_source"), "affiliate");
});

test("affiliate funnel milestones are additive, idempotent, and do not rewrite referral terms", async () => {
  const migration = await readFile(new URL("../database/migrations/098_provider_affiliate_funnel.sql", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/affiliates/funnel/route.ts", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/providers/onboarding/route.ts", import.meta.url), "utf8");
  const affiliates = await readFile(new URL("../lib/affiliates.ts", import.meta.url), "utf8");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS signup_started_at/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS first_listing_published_at/);
  assert.doesNotMatch(migration, /UPDATE\s+affiliate_(referrals|commissions)/i);
  assert.match(route, /signup_started_at=COALESCE\(signup_started_at,now\(\)\)/);
  assert.match(route, /account\."createdAt" >= click\.created_at/);
  assert.match(route, /session\.user\.id/);
  assert.match(onboarding, /account\."createdAt">=affiliate_clicks\.created_at/);
  assert.match(affiliates, /'onboarding_completed'/);
  assert.match(affiliates, /markAffiliateListingPublished/);
});

test("first public listing is recorded only when age verification activates a blocked service", async () => {
  const verification = await readFile(new URL("../lib/provider-age-verification.ts", import.meta.url), "utf8");
  assert.match(verification, /age_verification_blocked=true[\s\S]*RETURNING id::text,category,delivery_type,city,state/);
  assert.match(verification, /eventName: "first_listing_published"/);
  assert.match(verification, /markAffiliateListingPublished\(providerId, client\)/);
});

test("provider signup funnel supports both email and Google provider intent", async () => {
  const authForm = await readFile(new URL("../app/auth-form.tsx", import.meta.url), "utf8");
  const settings = await readFile(new URL("../app/account/settings/settings-form.tsx", import.meta.url), "utf8");
  assert.match(authForm, /recordProviderSignupStarted\(\)/);
  assert.match(authForm, /authClient\.signUp\.email/);
  assert.match(authForm, /authClient\.signIn\.social/);
  assert.match(authForm, /callbackURL: redirectTo/);
  assert.match(authForm, /newUserCallbackURL/);
  assert.match(settings, /requestedRedirect\.startsWith\("\/providers\/join"\)/);
  assert.match(settings, /router\.push\(postSignupRedirect\)/);
});
