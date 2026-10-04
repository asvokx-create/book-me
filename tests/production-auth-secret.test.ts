import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8");

test("production runtime refuses to start with the local development auth secret", () => {
  assert.match(authSource, /NODE_ENV === "production"/);
  assert.match(authSource, /NEXT_PHASE === "phase-production-build"/);
  assert.match(authSource, /BETTER_AUTH_SECRET is required in production/);
  assert.match(authSource, /secret: authSecret/);
});

test("DigitalOcean requests use the platform client IP for per-user auth rate limits", () => {
  assert.match(authSource, /ipAddressHeaders: \["do-connecting-ip", "x-forwarded-for"\]/);
});
