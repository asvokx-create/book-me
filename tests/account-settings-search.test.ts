import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("account settings search suggests and opens matching settings", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/account/settings/settings-form.tsx"), "utf8");

  assert.match(source, /const settingSearchItems/);
  assert.match(source, /keywords: "theme dark light appearance timezone time zone"/);
  assert.match(source, /keywords: "password login credentials"/);
  assert.match(source, /const settingsRecommendations = useMemo/);
  assert.match(source, /placeholder="Search settings"/);
  assert.match(source, /role="listbox" aria-label="Setting recommendations"/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});
