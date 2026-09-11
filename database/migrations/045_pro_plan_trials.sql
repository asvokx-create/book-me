ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS pro_trial_used_at_test timestamptz,
  ADD COLUMN IF NOT EXISTS pro_trial_used_at_live timestamptz;
