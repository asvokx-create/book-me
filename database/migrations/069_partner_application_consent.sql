ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS partner_agreement_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_agreement_version text;
