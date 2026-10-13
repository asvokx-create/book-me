import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../components/affiliate-admin.tsx", import.meta.url), "utf8");

test("Partner administration separates review applications from accepted accounts", () => {
  assert.match(admin, /Applications awaiting review/);
  assert.match(admin, /Accepted partners/);
  assert.match(admin, /\["approved","active","paused","suspended"\]/);
  assert.match(admin, /\["applied","under_review"\]/);
});

test("Partner records are compact until an administrator opens their details", () => {
  assert.match(admin, /<details className="group">/);
  assert.match(admin, /View details/);
  assert.match(admin, /<summary className="flex cursor-pointer/);
});
