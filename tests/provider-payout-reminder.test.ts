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
  const reminder = await readFile(new URL("../components/provider-activation-checklist.tsx", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../components/provider-dashboard.tsx", import.meta.url), "utf8");
  assert.match(reminder, /Connect Stripe payouts/);
  assert.match(reminder, /Set Up Stripe Payouts/);
  assert.match(reminder, /\/api\/stripe\/status/);
  assert.match(reminder, /\/api\/stripe\/connect/);
  assert.match(reminder, /setInterval[\s\S]*30_000/);
  assert.doesNotMatch(reminder, /dismiss|localStorage/);
  assert.match(reminder, /sm:flex-row/);
  assert.match(dashboard, /provider && !isWorker && <ProviderActivationChecklist/);
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

test("provider welcome email is durable, one-time, and links to authenticated provider pages", async () => {
  const email = await readFile(new URL("../lib/provider-welcome-email.ts", import.meta.url), "utf8");
  const onboarding = await readFile(new URL("../app/api/providers/onboarding/route.ts", import.meta.url), "utf8");
  const emailDestination = await readFile(new URL("../app/provider/payout-setup/page.tsx", import.meta.url), "utf8");
  assert.match(email, /provider_welcome_email_deliveries/);
  assert.match(email, /FOR UPDATE OF delivery SKIP LOCKED/);
  assert.match(email, /provider-welcome-\$\{row\.user_id\}/);
  assert.match(email, /Important: Set Up Your Stripe Payouts/);
  assert.match(email, /Set Up Stripe Payouts/);
  assert.match(email, /Go to Provider Dashboard/);
  assert.match(email, /\/provider\/payout-setup/);
  assert.match(email, /\/provider\/dashboard/);
  assert.match(emailDestination, /auth\.api\.getSession/);
  assert.match(emailDestination, /\/login\?redirect=\$\{encodeURIComponent\(billingPath\)\}/);
  assert.match(emailDestination, /redirect\(billingPath\)/);
  assert.match(onboarding, /enqueueProviderWelcomeEmail[\s\S]*client/);
  assert.match(onboarding, /COMMIT[\s\S]*deliverProviderWelcomeEmail/);
});

test("provider welcome delivery has automatic retries, webhook confirmation, and admin-only retry", async () => {
  const migration = await readFile(new URL("../database/migrations/100_provider_welcome_email_queue.sql", import.meta.url), "utf8");
  const queue = await readFile(new URL("../lib/provider-welcome-email.ts", import.meta.url), "utf8");
  const cron = await readFile(new URL("../app/api/cron/provider-welcome-emails/route.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/webhooks/marketing-email/route.ts", import.meta.url), "utf8");
  const adminRoute = await readFile(new URL("../app/api/admin/accounts/[userId]/route.ts", import.meta.url), "utf8");
  const adminDashboard = await readFile(new URL("../components/admin-dashboard.tsx", import.meta.url), "utf8");

  assert.match(migration, /PRIMARY KEY[\s\S]*status IN \('queued', 'sending', 'sent', 'delivered', 'failed'\)/);
  assert.match(queue, /attempt_count < 5/);
  assert.match(queue, /retryDelayMinutes/);
  assert.match(cron, /processProviderWelcomeEmailQueue/);
  assert.match(webhook, /provider_welcome_email_deliveries/);
  assert.match(webhook, /email\.delivered/);
  assert.match(adminRoute, /getAdminSession/);
  assert.match(adminRoute, /retry_provider_welcome/);
  assert.match(adminDashboard, /Provider welcome email/);
  assert.match(adminDashboard, /window\.confirm/);
});

test("existing Connect flow is owner-authorized and reuses current accounts", async () => {
  const connect = await readFile(new URL("../app/api/stripe/connect/route.ts", import.meta.url), "utf8");
  assert.match(connect, /auth\.api\.getSession/);
  assert.match(connect, /WHERE user_id = \$1 AND is_active = true/);
  assert.match(connect, /provider\.stripe_connect_mode === mode \? provider\.stripe_account_id : null/);
  assert.match(connect, /if \(!accountId\)/);
  assert.match(connect, /metadata: \{ providerId: provider\.id, userId: session\.user\.id \}/);
});
