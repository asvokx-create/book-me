import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const target = join(directory, entry);
    return statSync(target).isDirectory() ? sourceFiles(target) : /\.(?:tsx|ts)$/.test(entry) ? [target] : [];
  });
}

test("provider pricing describes shared CRM and campaign access separately from Pro-only growth tools", () => {
  const pricing = read("app", "pricing", "page.tsx");
  const guide = read("lib", "guides.ts");
  const plans = read("lib", "plans.ts");

  assert.match(pricing, /Customer records, booking history, private tags & notes/);
  assert.match(pricing, /Email campaigns with audience segments, branded templates & reporting/);
  assert.match(pricing, /Unsubscribe and suppression handling/);
  assert.match(pricing, /Coupon promotions & repeat-customer offers/);
  assert.match(guide, /private tags and notes, plus email campaigns with audience segments/);
  assert.match(plans, /starter:[\s\S]*?repeatCustomerTools: false,[\s\S]*?promotions: false/);
  assert.match(plans, /pro:[\s\S]*?repeatCustomerTools: true,[\s\S]*?promotions: true/);
});

test("provider booking lists retain the hourly-rate context from the booking snapshot", () => {
  const route = read("app", "api", "providers", "bookings", "route.ts");
  const dashboard = read("components", "provider-dashboard.tsx");

  assert.match(route, /b\.pricing_type_snapshot, b\.hourly_rate_cents_snapshot/);
  assert.match(route, /pricingType: row\.pricing_type_snapshot/);
  assert.match(route, /hourlyRateCents: row\.hourly_rate_cents_snapshot/);
  assert.match(dashboard, /function formatBookedPrice/);
  assert.match(dashboard, /formatHourlyRate\(booking\.hourlyRateCents\)/);
  assert.match(dashboard, /formatBookedPrice\(request\)/);
});

test("public labels use the consistent trust and partner vocabulary", () => {
  const provider = read("app", "providers", "[slug]", "page.tsx");
  const home = read("app", "page.tsx");

  assert.match(provider, /✓ Email verified/);
  assert.doesNotMatch(provider, /Email confirmed/);
  assert.match(home, />Partner Program</);
  assert.doesNotMatch(home, /For creators &amp; affiliates/);
});

test("narrow upcoming-category cards give labels a full-width layout without truncation", () => {
  const card = read("components", "upcoming-category-card.tsx");
  const css = read("app", "globals.css");

  assert.doesNotMatch(card, /whitespace-nowrap/);
  assert.match(css, /@media \(min-width: 360px\) and \(max-width: 399px\)[\s\S]*?\.home-upcoming-grid \{ grid-template-columns: 1fr; \}/);
});

test("normal application forms do not invoke native select or date pickers", () => {
  const files = [...sourceFiles(join(root, "app")), ...sourceFiles(join(root, "components"))];
  const nativeControls = files.filter((file) => {
    const source = readFileSync(file, "utf8");
    return /<select\b/.test(source) || /<input\b[^>]*\btype=["'](?:date|datetime-local|month|week)["']/.test(source);
  });

  assert.deepEqual(nativeControls, []);
});
