import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("light is the default display while dark and system remain manual options", async () => {
  const [layout, preferences, settingsRoute, settingsForm, migration] = await Promise.all([
    read("app/layout.tsx"),
    read("components/preferences-provider.tsx"),
    read("app/api/account/settings/route.ts"),
    read("app/account/settings/settings-form.tsx"),
    read("database/migrations/060_light_theme_default.sql"),
  ]);

  assert.match(layout, /getItem\("bubsbookings-theme"\)\|\|"light"/);
  assert.match(preferences, /storedTheme \?\? "light"/);
  assert.match(settingsRoute, /COALESCE\(us\.theme, 'light'\) AS theme/);
  assert.match(settingsRoute, /body\.theme === "system"/);
  assert.match(settingsForm, /theme: "light"/);
  assert.match(settingsForm, /\["light", "dark", "system"\]/);
  assert.match(migration, /ALTER COLUMN theme SET DEFAULT 'light'/);
  assert.match(migration, /WHERE theme = 'system'/);
});
