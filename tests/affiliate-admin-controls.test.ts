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

test("payout readiness approval is explicitly gated by live Stripe readiness", () => {
  assert.match(route,/getStripe\(\)\.accounts\.retrieve\(accountId\)/);
  assert.match(route,/account\.details_submitted && account\.payouts_enabled/);
  assert.match(route,/account\.capabilities\?\.transfers === "active"/);
  assert.match(route,/requirements\.length === 0/);
  assert.match(route,/affiliate\.rows\[0\]\.stripe_connect_mode !== getStripeMode\(\)/);
  assert.match(route,/if \(!stripeReady\) throw new Error\("STRIPE_NOT_READY"\)/);
  assert.match(route,/if \(!reason\) throw new Error\("INVALID"\)/);
  assert.match(component,/Payout compliance review/);
  assert.match(component,/Approve payout readiness/);
  assert.match(component,/Stripe readiness checklist/);
  assert.match(component,/No outstanding Stripe requirements/);
  assert.doesNotMatch(component,/Verify tax readiness|Tax review/);
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
