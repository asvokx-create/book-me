import assert from "node:assert/strict";
import test from "node:test";

import {
  POLICY_EFFECTIVE_DATE,
  POLICY_VERSION,
  PROVIDER_AGREEMENT_VERSION,
  createPolicyConsentFields,
} from "../lib/policy-consent.ts";

test("legal policy versions stay aligned with the displayed effective date", () => {
  assert.equal(POLICY_VERSION, "2026-09-21");
  assert.equal(PROVIDER_AGREEMENT_VERSION, POLICY_VERSION);
  assert.equal(POLICY_EFFECTIVE_DATE, "September 21, 2026");
});

test("new account consent records use the current policy version", () => {
  const consent = createPolicyConsentFields();
  assert.equal(consent.policyVersion, POLICY_VERSION);
  assert.ok(Number.isFinite(Date.parse(consent.termsAcceptedAt)));
  assert.equal(consent.termsAcceptedAt, consent.privacyAcknowledgedAt);
  assert.equal(consent.termsAcceptedAt, consent.aiSafetyAcknowledgedAt);
});
