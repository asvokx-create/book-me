import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app/account/settings/settings-form.tsx"), "utf8");

test("optional email changes cannot block the main account settings form", () => {
  assert.match(source, /form="email-change-form" type="email"/);
  assert.match(source, /type="submit" form="email-change-form"/);
  assert.match(source, /id="email-change-form"/);
  assert.match(source, /type="submit" disabled=\{saving\}/);
});

test("saving account settings does not invoke browser geolocation", () => {
  const saveButton = source.match(/<button type="submit" disabled=\{saving\}[\s\S]*?Save account settings[\s\S]*?<\/button>/)?.[0] ?? "";
  assert.ok(saveButton);
  assert.doesNotMatch(saveButton, /useBrowserLocation|geolocation|getCurrentPosition/);
});
