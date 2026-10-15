import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("provider outreach is admin-protected, reviewed, and safely deliverable", () => {
  const migration = read("database", "migrations", "085_admin_provider_outreach.sql");
  const deliveryMigration = read("database", "migrations", "089_provider_outreach_email_delivery.sql");
  const route = read("app", "api", "admin", "growth", "outreach", "route.ts");
  const ui = read("components", "admin-provider-outreach.tsx");
  const sender = read("lib", "provider-outreach-email.ts");
  const unsubscribe = read("app", "api", "outreach", "unsubscribe", "route.ts");

  assert.match(migration, /provider_outreach_prospects/);
  assert.match(migration, /provider_outreach_suppressions/);
  assert.match(migration, /provider_outreach_drafts/);
  assert.match(migration, /provider_outreach_prospects_identity_key/);
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /provider_outreach_suppressions/);
  assert.doesNotMatch(route, /approval note is required/i);
  assert.doesNotMatch(route, /sendMarketingEmail/);
  assert.match(deliveryMigration, /UNIQUE \(draft_id\)/);
  assert.match(deliveryMigration, /provider_outreach_deliveries/);
  assert.match(route, /action === "send_draft"/);
  assert.match(route, /action === "update_draft"/);
  assert.match(route, /A quick note from Christian at BubsBookings/);
  assert.match(route, /Drafting is an internal, reversible review step/);
  assert.doesNotMatch(route, /A non-suppressed public business email is required before making a draft/);
  assert.match(route, /admin-provider-outreach-send/);
  assert.match(route, /isOutreachEmailConfigured/);
  assert.match(route, /provider-outreach-\$\{draft\.id\}/);
  assert.match(sender, /OUTREACH_POSTAL_ADDRESS/);
  assert.match(sender, /List-Unsubscribe/);
  assert.match(sender, /Advertisement from BubsBookings/);
  assert.match(unsubscribe, /provider_outreach_suppressions/);
  assert.match(ui, /Send email/);
  assert.match(ui, /Create and review a draft first/);
  assert.match(ui, /You can create a draft now/);
  assert.match(ui, /Use friendlier wording/);
  assert.match(ui, /Optional approval note/);
  assert.match(ui, /recipient-facing message/);
  assert.match(ui, /permanently suppressed/i);
});
