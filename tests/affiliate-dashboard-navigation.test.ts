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

test("partner shortcuts appear only for approved Partner accounts, while administration stays in Admin",()=>{
  const account=read("components","account-nav.tsx");
  const mobile=read("components","mobile-site-nav.tsx");
  const customerAccount=read("app","account","page.tsx");
  assert.match(account,/affiliateAccess\.isAffiliate/);
  assert.match(account,/href="\/affiliate"/);
  assert.match(account,/Partner dashboard/);
  assert.match(mobile,/showAffiliateDashboard/);
  assert.match(mobile,/href="\/affiliate"/);
  assert.match(customerAccount,/isAffiliate && <option value="\/affiliate">Partner dashboard<\/option>/);
  assert.match(customerAccount,/isAffiliate && <Link href="\/affiliate"/);
  assert.doesNotMatch(customerAccount,/href="\/admin\/affiliates"/);
  assert.doesNotMatch(mobile,/\["Partner program", "\/partners"\]/);
});
