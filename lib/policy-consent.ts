export const POLICY_VERSION = "2026-10-04";
export const PROVIDER_AGREEMENT_VERSION = "2026-09-21";
export const POLICY_EFFECTIVE_DATE = "October 4, 2026";

export function createPolicyConsentFields() {
  const acceptedAt = new Date().toISOString();
  return {
    termsAcceptedAt: acceptedAt,
    privacyAcknowledgedAt: acceptedAt,
    aiSafetyAcknowledgedAt: acceptedAt,
    policyVersion: POLICY_VERSION,
  };
}
