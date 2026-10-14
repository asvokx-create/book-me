import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("provider settings hub offers a shared setting search and neutral account tile", () => {
  const dashboard = read("components", "provider-dashboard.tsx");
  const search = read("components", "provider-settings-search.tsx");

  assert.match(dashboard, /section === "settings" && <ProviderSettingsSearch \/>/);
  assert.match(search, /const settingDestinations/);
  assert.match(search, /Account settings/);
  assert.match(search, /Business profile/);
  assert.match(search, /Services and pricing/);
  assert.match(search, /Service locations/);
  assert.match(search, /Availability/);
  assert.match(search, /Company team/);
  assert.match(search, /Plan and billing/);
  assert.match(search, /aria-label="Provider setting recommendations"/);
  assert.match(search, /a\[href="\/account\/settings"\].*:hover/);
});
