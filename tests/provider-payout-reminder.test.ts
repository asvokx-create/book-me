import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { providerPayoutReminderCopy, providerPayoutSetupState } from "../lib/provider-payout-status.ts";

test("provider payout setup states require every Stripe readiness signal", () => {
  assert.equal(providerPayoutSetupState({ connected: false, detailsSubmitted: false, payoutsEnabled: false, transfersStatus: null }), "not_connected");
  assert.equal(providerPayoutSetupState({ connected: true, detailsSubmitted: false, payoutsEnabled: false, transfersStatus: "inactive", currentlyDue: ["business_profile.url"] }), "setup_incomplete");
  assert.equal(providerPayoutSetupState({ connected: true, detailsSubmitted: true, payoutsEnabled: false, transfersStatus: "pending" }), "under_review");
  assert.equal(providerPayoutSetupState({ connected: true, detailsSubmitted: true, payoutsEnabled: false, transfersStatus: "inactive", currentlyDue: ["individual.verification.document"] }), "action_required");
  assert.equal(providerPayoutSetupState({ connected: true, detailsSubmitted: true, payoutsEnabled: true, transfersStatus: "active", currentlyDue: [], pastDue: [] }), "ready");
});

test("provider payout reminder uses the required status-specific language", () => {
  assert.equal(providerPayoutReminderCopy("not_connected"), "Connect your Stripe account to receive payouts.");
  assert.equal(providerPayoutReminderCopy("setup_incomplete"), "Finish your Stripe setup to receive payouts.");
  assert.match(providerPayoutReminderCopy("under_review"), /under review/);
  assert.match(providerPayoutReminderCopy("action_required"), /additional information/);
});

test("dashboard reminder is persistent, responsive, and opens the existing Connect flow", async () => {
  const reminder = await readFile(new URL("../components/provider-payout-reminder.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/provider-dashboard.tsx", import.meta.url), "utf8");
  assert.match(reminder, /Complete Your Payout Setup/);
  assert.match(reminder, /Set Up Stripe Payouts/);
  assert.match(reminder, /\/api\/stripe\/status/);
  assert.match(reminder, /\/api\/stripe\/connect/);
  assert.match(reminder, /setInterval[\s\S]*30_000/);
  assert.doesNotMatch(reminder, /dismiss|localStorage/);
  assert.match(reminder, /sm:flex-row/);
  assert.match(dashboard, /provider && !isWorker && <ProviderPayoutReminder/);
});

test("Stripe status uses details, payouts, transfers, and outstanding requirements", async () => {
  const status = await readFile(new URL("../app/api/stripe/status/route.ts", import.meta.url), "utf8");
  assert.match(status, /account\.details_submitted/);
  assert.match(status, /account\.payouts_enabled/);
  assert.match(status, /account\.capabilities\?\.transfers/);
  assert.match(status, /account\.requirements\?\.currently_due/);
  assert.match(status, /account\.requirements\?\.past_due/);
  assert.match(status, /account\.requirements\?\.disabled_reason/);
  assert.match(status, /Cache-Control": "private, no-store/);
});

test("provider welcome email is one-time and links to authenticated billing setup", async () => {
  const email = await readFile(new URL("../lib/provider-welcome-email.ts", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/providers/onboarding/route.ts", import.meta.url), "utf8");
  const emailDestination = await readFile(new URL("../app/provider/payout-setup/page.tsx", import.meta.url), "utf8");
  assert.match(email, /email_type='provider_welcome'/);
  assert.match(email, /status='sent'/);
  assert.match(email, /provider-welcome-\$\{input\.userId\}/);
  assert.match(email, /Set Up Your Payouts/);
  assert.match(email, /Set Up Stripe Payouts/);
  assert.match(email, /\/provider\/payout-setup/);
  assert.match(emailDestination, /auth\.api\.getSession/);
  assert.match(emailDestination, /\/login\?redirect=\$\{encodeURIComponent\(billingPath\)\}/);
  assert.match(emailDestination, /redirect\(billingPath\)/);
  assert.match(onboarding, /if \(!existing\) await sendProviderWelcomeEmail/);
});

test("existing Connect flow is owner-authorized and reuses current accounts", async () => {
  const connect = await readFile(new URL("../app/api/stripe/connect/route.ts", import.meta.url), "utf8");
  assert.match(connect, /auth\.api\.getSession/);
  assert.match(connect, /WHERE user_id = \$1 AND is_active = true/);
  assert.match(connect, /provider\.stripe_connect_mode === mode \? provider\.stripe_account_id : null/);
  assert.match(connect, /if \(!accountId\)/);
  assert.match(connect, /metadata: \{ providerId: provider\.id, userId: session\.user\.id \}/);
});
