import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (...parts: string[]) => readFileSync(new URL(`../${parts.join("/")}`, import.meta.url), "utf8");

test("admin account cards show provider and approved Partner account types", () => {
  const route = read("app", "api", "admin", "route.ts");
  const dashboard = read("components", "admin-dashboard.tsx");

  assert.match(route, /EXISTS \(SELECT 1 FROM affiliate_profiles partner WHERE partner\.user_id = u\.id AND partner\.status IN \('approved','active','paused','suspended'\)\) AS is_partner/);
  assert.match(dashboard, /is_partner: boolean/);
  assert.match(dashboard, /account\.provider_id && <span[^>]*>Provider<\/span>/);
  assert.match(dashboard, /account\.is_partner && <span[^>]*>Partner<\/span>/);
  assert.match(dashboard, /account type/);
});
