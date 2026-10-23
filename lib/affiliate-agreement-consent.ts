export type AffiliateAgreementConsent = {
  partnerAgreementAccepted?: unknown;
  termsAccepted?: unknown;
  privacyAcknowledged?: unknown;
};

function affirmed(value: unknown) {
  return value === true || value === "true";
}

export function validateAffiliateAgreementConsent(input: AffiliateAgreementConsent) {
  const missing = [
    !affirmed(input.partnerAgreementAccepted) && "Partner Agreement",
    !affirmed(input.termsAccepted) && "Terms of Service",
    !affirmed(input.privacyAcknowledged) && "Privacy Policy",
  ].filter((value): value is string => Boolean(value));

  return {
    accepted: missing.length === 0,
    missing,
  };
}
