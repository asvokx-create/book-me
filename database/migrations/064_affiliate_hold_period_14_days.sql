-- Shorten the standard program hold for referrals attributed after this change.
-- Existing referrals keep the hold_period_days value snapshotted at attribution.
UPDATE affiliate_programs
SET hold_period_days = 14,
    updated_at = now()
WHERE name = 'Standard Creator Program'
  AND hold_period_days = 30;

ALTER TABLE affiliate_programs
  ALTER COLUMN hold_period_days SET DEFAULT 14;
