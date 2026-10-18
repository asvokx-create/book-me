import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();

test("verification email delivery is protected by a server-side cooldown", async () => {
  const emailSource = await readFile(path.join(projectRoot, "lib", "email.ts"), "utf8");

  assert.match(emailSource, /ACCOUNT_VERIFICATION_COOLDOWN_MS = 15 \* 60 \* 1000/);
  assert.match(emailSource, /pg_try_advisory_lock/);
  assert.match(emailSource, /account-verification:\$\{recipient\}/);
  assert.match(emailSource, /email_type = 'account_verification'/);
  assert.match(emailSource, /interval '15 minutes'/);
  assert.match(emailSource, /verificationEmailIdempotencyKey\(recipient\)/);
  assert.match(emailSource, /"Idempotency-Key": idempotencyKey/);
});

test("verification requests wait for send completion and prevent repeated clicks", async () => {
  const authSource = await readFile(path.join(projectRoot, "lib", "auth.ts"), "utf8");
  const securitySource = await readFile(path.join(projectRoot, "app", "account", "security", "security-settings.tsx"), "utf8");

  assert.match(authSource, /await sendAuthEmail\(\{ to: user\.email, name: user\.name, url, kind: "verify" \}\)/);
  assert.match(securitySource, /verificationRequested/);
  assert.match(securitySource, /verificationSending \|\| verificationRequested/);
  assert.match(securitySource, /another link can be requested in 15 minutes/);
});
