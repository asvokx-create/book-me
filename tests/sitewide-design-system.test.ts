import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("the shared product system uses the homepage palette and geometry", () => {
  const css = read("app", "globals.css");
  for (const token of [
    "--bb-forest: #102d22",
    "--bb-green: #15935d",
    "--bb-canvas: #f8f8f4",
    "--bb-yellow: #eee25a",
    "--bb-text-muted: #61746a",
    "--bb-radius-card: 1rem",
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /Website-wide product system/);
  assert.match(css, /\.custom-select-trigger, \.date-picker-trigger/);
  assert.match(css, /\.admin-table-scroll/);
  assert.match(css, /\[role="dialog"\] > div/);
});

test("authenticated areas expose stable visual scope wrappers", () => {
  assert.match(read("app", "account", "layout.tsx"), /className="account-area contents"/);
  assert.match(read("app", "provider", "layout.tsx"), /className="provider-area contents"/);
  assert.match(read("app", "admin", "layout.tsx"), /className="admin-area contents"/);
  assert.match(read("app", "affiliate", "page.tsx"), /className="affiliate-page/);
});

test("provider navigation is organized by business task", () => {
  const dashboard = read("components", "provider-dashboard.tsx");
  for (const group of ["Business", "Growth", "Financial", "Account"]) {
    assert.match(dashboard, new RegExp(`group: "${group}"`));
  }
  assert.match(dashboard, /dashboard-nav-group/);
  assert.match(dashboard, /Billing & subscription/);
  assert.match(dashboard, /Company profile/);
});

test("responsive product rules protect phone and wide dashboard layouts", () => {
  const css = read("app", "globals.css");
  assert.match(css, /@media \(min-width: 1440px\)[\s\S]*?\.dashboard-shell/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?main > header/);
  assert.match(css, /overflow-wrap: normal; word-break: normal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("footer actions keep their dark-footer contrast", () => {
  const css = read("app", "globals.css");
  const footer = read("components", "site-footer.tsx");

  assert.doesNotMatch(css, /:where\(main, footer\) :where\(a, button\)\[class\*="border"\]\[class\*="bg-white"\]/);
  assert.match(css, /:where\(main\) :where\(a, button\)\[class\*="border"\]\[class\*="bg-white"\]/);
  assert.match(footer, /List your service/);
  assert.match(footer, /Contact support/);
});
