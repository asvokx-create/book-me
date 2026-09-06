ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS provider_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_agreement_version text;
