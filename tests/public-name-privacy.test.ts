import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { publicPersonalName } from "../lib/public-provider-identity.ts";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("personal-name visibility is privacy protective for new and existing accounts", () => {
  const migration = read("database", "migrations", "074_public_personal_name_visibility.sql");
  assert.match(migration, /public_personal_name_visible boolean NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS/);
});

test("Google and existing-account names stay private until the owner opts in", () => {
  assert.equal(publicPersonalName("John Smith", false), null);
  assert.equal(publicPersonalName("Jane Doe", false), null);
  assert.equal(publicPersonalName("John Smith", true), "John Smith");
  assert.equal(publicPersonalName("   ", true), null);
});

test("only provider owners receive and persist the public-name preference", () => {
  const route = read("app", "api", "account", "settings", "route.ts");
  assert.match(route, /\(p\.id IS NOT NULL\) AS is_provider_owner/);
  assert.match(route, /publicPersonalNameVisible: row\.is_provider_owner && row\.public_personal_name_visible/);
  assert.match(route, /CASE WHEN \$11::boolean THEN EXCLUDED\.public_personal_name_visible ELSE user_settings\.public_personal_name_visible END/);
  assert.match(route, /public_personal_name_visibility_updated/);
});

test("public provider data never returns the raw owner name while visibility is off", () => {
  const marketplace = read("lib", "marketplace.ts");
  const companies = read("lib", "companies.ts");
  const companyPage = read("app", "companies", "[slug]", "page.tsx");

  assert.match(marketplace, /COALESCE\(settings\.public_personal_name_visible, false\)/);
  assert.match(marketplace, /publicOwnerName: publicPersonalName\(provider\.owner_name, provider\.public_personal_name_visible\)/);
  assert.doesNotMatch(marketplace, /ownerName: provider\.owner_name/);
  assert.match(companies, /CASE WHEN COALESCE\(settings\.public_personal_name_visible, false\) THEN owner\.name ELSE NULL END AS public_owner_name/);
  assert.match(companyPage, /company\.publicOwnerName && <>Owned by/);
  assert.doesNotMatch(companyPage, /company\.ownerName/);
});

test("privacy setting is accessible, explicit, responsive, and cache-aware", () => {
  const form = read("app", "account", "settings", "settings-form.tsx");
  const route = read("app", "api", "account", "settings", "route.ts");

  assert.match(form, /settings\.isProviderOwner && <section/);
  assert.match(form, /Show my personal name publicly/);
  assert.match(form, /checked=\{settings\.publicPersonalNameVisible\}/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /peer-focus-visible:outline/);
  assert.match(form, /\{checked \? "ON" : "OFF"\}/);
  assert.match(route, /revalidatePath\("\/providers\/\[slug\]", "page"\)/);
  assert.match(route, /revalidatePath\("\/companies\/\[slug\]", "page"\)/);
  assert.match(route, /revalidatePath\("\/services\/\[slug\]", "page"\)/);
});

test("public metadata and structured data keep the business identity", () => {
  const providerPage = read("app", "providers", "[slug]", "page.tsx");
  const servicePage = read("app", "services", "[slug]", "page.tsx");
  const onboarding = read("app", "api", "providers", "onboarding", "route.ts");

  assert.match(providerPage, /title = provider\.hasInPersonServices \? `\$\{provider\.businessName\}/);
  assert.match(providerPage, /name: provider\.businessName/);
  assert.doesNotMatch(providerPage, /provider\.publicOwnerName/);
  assert.doesNotMatch(servicePage, /ownerName|personalName|publicOwnerName/);
  assert.match(onboarding, /slugifyProviderName\(business\)/);
});
