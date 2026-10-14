-- Stripe Connect readiness is not evidence of a provider's age. Store only
-- the minimal state needed to enforce a separate Stripe Identity age check.
ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS age_verification_status text NOT NULL DEFAULT 'not_started'
    CHECK (age_verification_status IN ('not_started', 'pending', 'requires_input', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS stripe_identity_verification_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_identity_verification_mode text
    CHECK (stripe_identity_verification_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS age_identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_verification_failure_code text;

CREATE UNIQUE INDEX IF NOT EXISTS provider_profiles_stripe_identity_session_key
  ON provider_profiles(stripe_identity_verification_session_id)
  WHERE stripe_identity_verification_session_id IS NOT NULL;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS age_verification_blocked boolean NOT NULL DEFAULT false;

-- Existing providers are deliberately not grandfathered into an age-verification
-- result merely because they completed Connect onboarding in the past.
UPDATE services service
SET is_active = false, age_verification_blocked = true
FROM provider_profiles provider
WHERE service.provider_id = provider.id
  AND provider.age_verification_status <> 'verified';
