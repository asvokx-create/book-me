import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  AGE_ELIGIBILITY_COOKIE,
  createAgeEligibilityAttestation,
  getAgeEligibilityAttestationFromCookie,
  hasValidAgeEligibilityAttestation,
  isAtLeastEighteen,
  verifyAgeEligibilityAttestation,
} from "../lib/age-eligibility.ts";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const birthday = new Date("2026-10-13T12:00:00.000Z");

test("age eligibility respects eighteenth-birthday boundaries and rejects invalid dates", () => {
  assert.equal(isAtLeastEighteen("2008-10-13", birthday), true);
  assert.equal(isAtLeastEighteen("2008-10-14", birthday), false);
  assert.equal(isAtLeastEighteen("2008-10-12", birthday), true);
  assert.equal(isAtLeastEighteen("2009-10-13", birthday), false);
  assert.equal(isAtLeastEighteen("2008-02-30", birthday), false);
  assert.equal(isAtLeastEighteen("2027-01-01", birthday), false);
});

test("signed attestation contains no date of birth and expires", () => {
  const issuedAt = new Date("2026-10-13T12:00:00.000Z");
  const token = createAgeEligibilityAttestation(issuedAt);
  assert.equal(verifyAgeEligibilityAttestation(token, new Date("2026-10-13T12:10:00.000Z")), true);
  assert.equal(verifyAgeEligibilityAttestation(token, new Date("2026-10-13T12:31:00.000Z")), false);
  assert.doesNotMatch(token, /2008-10-13/);
  assert.equal(getAgeEligibilityAttestationFromCookie(`other=value; ${AGE_ELIGIBILITY_COOKIE}=${token}`), token);
  const currentToken = createAgeEligibilityAttestation();
  assert.equal(hasValidAgeEligibilityAttestation(`${AGE_ELIGIBILITY_COOKIE}=${currentToken}`), true);
});

test("the eligibility endpoint and authentication hooks enforce a server-side signed gate", () => {
  const route = read("app/api/age-eligibility/route.ts");
  const auth = read("lib/auth.ts");
  const form = read("app/auth-form.tsx");
  const migration = read("database/migrations/081_age_eligibility.sql");
  assert.match(route, /isAtLeastEighteen\(dateOfBirth\)/);
  assert.match(route, /You must be at least 18 years old to use BubsBookings\./);
  assert.match(auth, /hasValidAgeEligibilityAttestation\(context\?\.headers\?\.get\("cookie"\)\)/);
  assert.match(auth, /ageVerifiedAt: new Date\(\)/);
  assert.match(auth, /UPDATE "user" SET age_verified_at = now\(\)/);
  assert.match(auth, /disableImplicitSignUp: true/);
  assert.match(form, /function DateOfBirthFields/);
  assert.match(form, /ariaLabel="Birth month"/);
  assert.match(form, /ariaLabel="Birth day"/);
  assert.match(form, /ariaLabel="Birth year"/);
  assert.match(form, /placeholder="Day"/);
  assert.match(form, /Enter your complete date of birth\./);
  assert.match(form, /Confirm your age before entering account details/);
  assert.match(migration, /DELETE FROM "session" AS active_session/);
  assert.match(migration, /account\.age_verified_at IS NULL/);
});
