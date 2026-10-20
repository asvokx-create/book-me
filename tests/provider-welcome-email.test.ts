import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider activation queues exactly one provider welcome for any authenticated account type", async () => {
  const [onboarding, queue, migration] = await Promise.all([
    read("app/api/providers/onboarding/route.ts"),
    read("lib/provider-welcome-email.ts"),
    read("database/migrations/100_provider_welcome_email_queue.sql"),
  ]);
  assert.match(onboarding, /auth\.api\.getSession/);
  assert.match(onboarding, /if \(!existing\)[\s\S]*enqueueProviderWelcomeEmail/);
  assert.match(queue, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(migration, /user_id text PRIMARY KEY/);
});

test("provider welcome is not queued until onboarding has created an active profile and listing", async () => {
  const onboarding = await read("app/api/providers/onboarding/route.ts");
  const serviceInsert = onboarding.indexOf("INSERT INTO services");
  const enqueue = onboarding.indexOf("enqueueProviderWelcomeEmail({");
  const commit = onboarding.indexOf('client.query("COMMIT")');
  assert.ok(serviceInsert >= 0 && enqueue > serviceInsert && commit > enqueue);
});

test("provider activation is committed before email delivery and survives Resend failure", async () => {
  const onboarding = await read("app/api/providers/onboarding/route.ts");
  assert.match(onboarding, /client\.query\("COMMIT"\)[\s\S]*deliverProviderWelcomeEmail[\s\S]*\.catch/);
});

test("failed provider welcomes are durably retried without concurrent duplicate claims", async () => {
  const queue = await read("lib/provider-welcome-email.ts");
  assert.match(queue, /status IN \('queued','failed'\)/);
  assert.match(queue, /attempt_count < 5/);
  assert.match(queue, /FOR UPDATE OF delivery SKIP LOCKED/);
  assert.match(queue, /provider-welcome-\$\{row\.user_id\}/);
  assert.match(queue, /status='failed'[\s\S]*next_attempt_at/);
});

test("scheduled operations process pending provider welcomes without an admin session", async () => {
  const [cron, trigger] = await Promise.all([
    read("app/api/cron/provider-welcome-emails/route.ts"),
    read("lib/payout-cron-trigger.mjs"),
  ]);
  assert.match(cron, /secureSecretMatches/);
  assert.match(cron, /processProviderWelcomeEmailQueue/);
  assert.match(trigger, /PROVIDER_WELCOME_EMAILS_PATH/);
});

test("provider welcome content includes the required Stripe and dashboard actions", async () => {
  const email = await read("lib/provider-welcome-email.ts");
  assert.match(email, /subject: "Welcome to BubsBookings!"/);
  assert.match(email, /Important: Set Up Your Stripe Payouts/);
  assert.match(email, /Before you can receive payouts from bookings/);
  assert.match(email, /Set Up Stripe Payouts/);
  assert.match(email, /Go to Provider Dashboard/);
  assert.match(email, /Christian/);
});

test("Resend delivery events reconcile provider welcome status", async () => {
  const [webhook, queue] = await Promise.all([
    read("app/api/webhooks/marketing-email/route.ts"),
    read("lib/provider-welcome-email.ts"),
  ]);
  assert.match(webhook, /Invalid signature/);
  assert.match(webhook, /provider_welcome_email_deliveries/);
  assert.match(webhook, /email\.delivered/);
  assert.match(webhook, /status=\$2/);
  assert.match(queue, /api\.resend\.com\/emails\/\$\{encodeURIComponent\(row\.provider_message_id\)\}/);
  assert.match(queue, /last_event/);
});

test("admin provider welcome visibility and retry remain server-authorized and audited", async () => {
  const [route, dashboard] = await Promise.all([
    read("app/api/admin/accounts/[userId]/route.ts"),
    read("components/admin-dashboard.tsx"),
  ]);
  assert.match(route, /getAdminSession/);
  assert.match(route, /retry_provider_welcome/);
  assert.match(route, /provider_welcome_email_retried/);
  assert.match(dashboard, /Status: <strong>/);
  assert.match(dashboard, /Send provider welcome/);
  assert.match(dashboard, /window\.confirm/);
});

test("migration does not backfill or send welcomes to existing providers", async () => {
  const migration = await read("database/migrations/100_provider_welcome_email_queue.sql");
  assert.doesNotMatch(migration, /INSERT[\s\S]+SELECT[\s\S]+provider_profiles/i);
});
