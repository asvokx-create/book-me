-- The Stripe Identity age check applies to every provider created after this
-- migration. Providers who already existed when the policy was introduced can
-- only be enabled through an explicit, documented administrator exception.
ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS age_verification_source text
    CHECK (age_verification_source IN ('stripe_identity', 'admin_exception')),
  ADD COLUMN IF NOT EXISTS age_verification_exception_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verification_exception_note text,
  ADD COLUMN IF NOT EXISTS age_verification_exception_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_verification_exception_granted_by text REFERENCES "user"(id) ON DELETE SET NULL;

-- Snapshot only the providers already awaiting the newly introduced check.
-- Providers created after this migration retain the default false value.
UPDATE provider_profiles
SET age_verification_exception_eligible = true
WHERE age_verification_status <> 'verified';
