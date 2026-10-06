import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const dashboard = readFileSync(join(process.cwd(), "components", "provider-dashboard.tsx"), "utf8");

test("provider welcome notices stay dismissed across dashboard sections", () => {
  assert.match(dashboard, /bubsbookings\.provider-welcome-dismissed\.\$\{userId\}/);
  assert.match(dashboard, /window\.localStorage\.setItem\(welcomeNoticeStorageKey\(userId\), "1"\)/);
  assert.match(dashboard, /window\.localStorage\.getItem\(welcomeNoticeStorageKey\(userId\)\) !== "1"/);
  assert.match(dashboard, /notice\?\.kind === "welcome"/);
});

test("provider saves use a temporary confirmation rather than restoring the welcome notice", () => {
  assert.match(dashboard, /const SAVED_NOTICE_DURATION_MS = 5000/);
  assert.match(dashboard, /setNotice\(\{ kind: "saved", message \}\)/);
  assert.match(dashboard, /window\.setTimeout\(\(\) => setNotice\(null\), SAVED_NOTICE_DURATION_MS\)/);
  assert.match(dashboard, /showSavedNotice\("Your dashboard layout has been saved\."\)/);
});
