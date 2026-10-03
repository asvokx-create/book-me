import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(...parts:string[])=>readFileSync(new URL(`../${parts.join("/")}`,import.meta.url),"utf8");

test("the account navigation API derives affiliate access from protected account records",()=>{
  const route=read("app","api","account","navigation","route.ts");
  assert.match(route,/auth\.api\.getSession/);
  assert.match(route,/FROM affiliate_profiles/);
  assert.match(route,/status IN \('approved','active','paused'\)/);
  assert.match(route,/isAffiliate: Boolean\(affiliate\.rowCount\)/);
});

test("affiliate shortcuts appear in desktop and mobile signed-in navigation",()=>{
  const account=read("components","account-nav.tsx");
  const mobile=read("components","mobile-site-nav.tsx");
  assert.match(account,/affiliateAccess\.isAffiliate/);
  assert.match(account,/href="\/affiliate"/);
  assert.match(account,/Partner dashboard/);
  assert.match(mobile,/showAffiliateDashboard/);
  assert.match(mobile,/href="\/affiliate"/);
});
