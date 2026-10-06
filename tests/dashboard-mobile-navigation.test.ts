import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("customer and provider dashboards use custom mobile navigation menus instead of horizontal tab strips", () => {
  const account = read("app", "account", "page.tsx");
  const provider = read("components", "provider-dashboard.tsx");

  assert.match(account, /<CustomSelect ariaLabel="Customer account navigation"/);
  assert.match(account, /placeholder="Choose an account area"/);
  assert.doesNotMatch(account, /mobile-scroll-row/);
  assert.match(provider, /<CustomSelect ariaLabel="Provider dashboard section"/);
  assert.doesNotMatch(provider, /mobile-scroll-row/);
});

test("mobile service-category labels stay on one line", () => {
  const css = read("app", "globals.css");

  assert.match(css, /\.home-category-card > div:not\(\.pointer-events-none\) p \{[^}]*white-space: nowrap/);
  assert.match(css, /\.home-category-card > div:not\(\.pointer-events-none\) > svg \{ display: none; \}/);
});
