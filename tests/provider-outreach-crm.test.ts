import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("provider outreach is a separate, admin-protected draft workflow", () => {
  const migration = read("database", "migrations", "085_admin_provider_outreach.sql");
  const route = read("app", "api", "admin", "growth", "outreach", "route.ts");
  const ui = read("components", "admin-provider-outreach.tsx");

  assert.match(migration, /provider_outreach_prospects/);
  assert.match(migration, /provider_outreach_suppressions/);
  assert.match(migration, /provider_outreach_drafts/);
  assert.match(migration, /provider_outreach_prospects_identity_key/);
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /provider_outreach_suppressions/);
  assert.match(route, /approval note is required/i);
  assert.doesNotMatch(route, /sendMarketingEmail/);
  assert.match(ui, /It does not send email/);
  assert.match(ui, /permanently suppressed/i);
});
