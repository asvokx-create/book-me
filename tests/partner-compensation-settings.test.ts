import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { campaignDurationLabel, partnerCompensationHeading } from "../lib/partner-compensation.ts";

const read=(...parts:string[])=>readFileSync(new URL(`../${parts.join("/")}`,import.meta.url),"utf8");

test("compensation migration preserves standard defaults and safely classifies fixed campaign partners",()=>{
  const migration=read("database","migrations","068_partner_compensation_settings.sql");
  assert.match(migration,/activation_bonus_enabled boolean NOT NULL DEFAULT true/);
  assert.match(migration,/revenue_share_enabled boolean NOT NULL DEFAULT true/);
  assert.match(migration,/WHERE name = 'Standard Creator Program'/);
  assert.match(migration,/compensation_type = 'custom'/);
  assert.match(migration,/activation_bonus_enabled_override = false/);
  assert.match(migration,/milestone_bonuses_override = false/);
  assert.match(migration,/is_compensation_default/);
});

test("new referrals snapshot activation and revenue enablement",()=>{
  const source=read("lib","affiliates.ts");
  assert.match(source,/activation_bonus_enabled, revenue_share_enabled, activation_bonus_cents/);
  assert.match(source,/row\.activation_bonus_enabled && row\.activation_bonus_cents > 0/);
  assert.match(source,/row\.revenue_share_enabled && inShareWindow && shareAmount > 0/);
});

test("milestones create no ledger, notification, or email work while disabled",()=>{
  const source=read("lib","affiliate-milestones.ts");
  assert.match(source,/if \(!progress\.enabled\) return \{ created: 0, reversed: 0/);
  assert.match(source,/COALESCE\(affiliate\.milestone_bonuses_override,program\.milestone_bonuses_enabled,false\)=true/);
});

test("admin reviews all compensation features and dashboard hides excluded rewards",()=>{
  const admin=read("components","affiliate-admin.tsx");
  const route=read("app","api","admin","affiliates","route.ts");
  const dashboard=read("app","affiliate","page.tsx");
  const summary=read("components","partner-compensation-summary.tsx");
  for(const field of ["activationBonusEnabled","milestoneBonusesEnabled","revenueShareEnabled","customCampaignEnabled"]){
    assert.match(admin,new RegExp(`name="${field}"`));
  }
  assert.doesNotMatch(admin,/Required admin reason/);
  assert.match(route,/if \(!terms\) throw new Error\("INVALID"\)/);
  assert.doesNotMatch(route,/if \(!terms \|\| !reason\) throw new Error\("INVALID"\)/);
  assert.match(route,/affiliate_overrides_changed/);
  assert.match(dashboard,/profile\.milestone_bonuses_enabled&&milestoneProgress/);
  assert.doesNotMatch(dashboard,/custom_campaign_notes/);
  assert.match(summary,/props\.activationBonusEnabled \?/);
  assert.match(summary,/props\.revenueShareEnabled \?/);
  assert.match(summary,/props\.milestoneBonusesEnabled \?/);
  assert.match(summary,/props\.customCampaignEnabled && props\.customCampaignAmountCents !== null \?/);
  assert.doesNotMatch(summary,/Disabled<\/dd>/);
});

test("Preston-style terms are representable without activation or milestone inheritance",()=>{
  const admin=read("components","affiliate-admin.tsx");
  assert.match(admin,/custom_campaign_amount_cents\?\?50000/);
  assert.match(admin,/revenue_share_basis_points\?\?2000/);
  assert.match(admin,/revenue_share_duration_months\?\?6/);
  assert.match(admin,/Program type/);
  assert.equal(partnerCompensationHeading("custom"),"Custom Partnership");
  assert.equal(campaignDurationLabel("2026-09-01","2026-09-30"),"1 month");
});

test("public Partner copy distinguishes standard terms from account-specific compensation",()=>{
  const publicPage=read("app","partners","page.tsx");
  const termsLink=read("components","partner-terms-link.tsx");
  assert.match(publicPage,/Standard Partner Program/);
  assert.match(publicPage,/Partners are rewarded for helping qualified providers join and grow on BubsBookings\./);
  assert.match(publicPage,/Compensation varies by approved Partner terms\./);
  assert.match(publicPage,/Provider Growth Milestones/);
  assert.match(publicPage,/Earnings become payable after the required hold period/);
  assert.doesNotMatch(publicPage,/\$10|20%|\$250|\$25|\$5|\$900/);
  assert.doesNotMatch(publicPage,/Standard creator program/i);
  assert.match(termsLink,/result\?\.authenticated && result\.isAffiliate/);
  assert.match(termsLink,/href="\/affiliate#partner-terms"/);
  assert.match(termsLink,/View my Partner terms/);
});
