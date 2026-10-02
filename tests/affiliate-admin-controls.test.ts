import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const component = readFileSync(join(root,"components","affiliate-admin.tsx"),"utf8");
const route = readFileSync(join(root,"app","api","admin","affiliates","route.ts"),"utf8");

test("every partner action control is wired to its matching admin API action", () => {
  for (const action of [
    "affiliate_status",
    "affiliate_payment_readiness",
    "manual_adjustment",
    "affiliate_overrides",
    "milestone_backfill_approve",
  ]) {
    assert.match(component,new RegExp(`action:\\s*"${action}"`));
    assert.match(route,new RegExp(`action === "${action}"`));
  }
});

test("consequential actions are validated, audited, and refresh the dashboard", () => {
  assert.match(component,/await load\(\)/);
  assert.match(component,/disabled=\{busy===item\.id\}/);
  assert.match(route,/affiliate_status_changed/);
  assert.match(route,/affiliate_payment_readiness_changed/);
  assert.match(route,/manual_adjustment_created/);
  assert.match(route,/affiliate_overrides_changed/);
  assert.match(component,/name="milestoneBonusesEnabled"/);
  assert.match(route,/milestone_bonuses_override/);
  assert.match(route,/milestone_backfill_approved/);
});

test("historical milestone approval requires an explicit review note", () => {
  assert.match(component,/This can create real bonus liabilities\./);
  assert.match(component,/name="reason" required maxLength=\{1000\}/);
  assert.match(route,/if \(!reason\) throw new Error\("INVALID"\)/);
  assert.match(route,/evaluateAffiliateMilestonesForAffiliate\(targetId,client\)/);
});

test("the affiliate code control copies the actual code and reports success or failure", () => {
  assert.match(component,/navigator\.clipboard\.writeText\(code\)/);
  assert.match(component,/aria-label=\{`Copy affiliate code/);
  assert.match(component,/Copied ✓/);
  assert.match(component,/could not be copied/);
});
