ALTER TABLE affiliate_programs
  ADD COLUMN IF NOT EXISTS program_type text NOT NULL DEFAULT 'standard'
    CHECK (program_type IN ('standard','custom')),
  ADD COLUMN IF NOT EXISTS activation_bonus_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revenue_share_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_campaign_enabled boolean NOT NULL DEFAULT false;

UPDATE affiliate_programs
SET program_type = CASE WHEN name = 'Standard Creator Program' THEN 'standard' ELSE 'custom' END,
    activation_bonus_enabled = activation_bonus_cents > 0,
    revenue_share_enabled = revenue_share_basis_points > 0 AND revenue_share_duration_months > 0,
    custom_campaign_enabled = false;

UPDATE affiliate_programs
SET program_type = 'standard', activation_bonus_enabled = true,
    revenue_share_enabled = true, milestone_bonuses_enabled = true,
    custom_campaign_enabled = false
WHERE name = 'Standard Creator Program';

ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS compensation_type text NOT NULL DEFAULT 'standard'
    CHECK (compensation_type IN ('standard','custom')),
  ADD COLUMN IF NOT EXISTS activation_bonus_enabled_override boolean,
  ADD COLUMN IF NOT EXISTS revenue_share_enabled_override boolean,
  ADD COLUMN IF NOT EXISTS custom_campaign_enabled_override boolean,
  ADD COLUMN IF NOT EXISTS custom_campaign_amount_cents integer
    CHECK (custom_campaign_amount_cents IS NULL OR custom_campaign_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS custom_campaign_starts_on date,
  ADD COLUMN IF NOT EXISTS custom_campaign_ends_on date,
  ADD COLUMN IF NOT EXISTS custom_campaign_notes text NOT NULL DEFAULT '';

ALTER TABLE affiliate_profiles DROP CONSTRAINT IF EXISTS affiliate_profiles_custom_campaign_dates_check;
ALTER TABLE affiliate_profiles ADD CONSTRAINT affiliate_profiles_custom_campaign_dates_check CHECK (
  custom_campaign_ends_on IS NULL OR custom_campaign_starts_on IS NULL
  OR custom_campaign_ends_on >= custom_campaign_starts_on
);

-- Existing fixed-fee campaign partners are treated conservatively as custom partners.
-- Their bonus features remain off unless an administrator explicitly reviews and enables them.
WITH latest_campaign AS (
  SELECT DISTINCT ON (fixed.affiliate_id) fixed.affiliate_id, fixed.fixed_amount_cents,
    fixed.campaign_starts_on, fixed.campaign_ends_on, fixed.notes, fixed.revenue_share_basis_points
  FROM creator_campaign_payments fixed
  WHERE fixed.payment_status <> 'cancelled'
  ORDER BY fixed.affiliate_id, fixed.created_at DESC
)
UPDATE affiliate_profiles affiliate
SET compensation_type = 'custom',
    activation_bonus_enabled_override = false,
    milestone_bonuses_override = false,
    revenue_share_enabled_override = COALESCE(
      campaign.revenue_share_basis_points,
      affiliate.revenue_share_override_basis_points,
      program.revenue_share_basis_points,
      0
    ) > 0,
    custom_campaign_enabled_override = true,
    custom_campaign_amount_cents = campaign.fixed_amount_cents,
    custom_campaign_starts_on = campaign.campaign_starts_on,
    custom_campaign_ends_on = campaign.campaign_ends_on,
    custom_campaign_notes = campaign.notes,
    milestone_backfill_approved = false
FROM affiliate_programs program, latest_campaign campaign
WHERE program.id = affiliate.program_id AND campaign.affiliate_id = affiliate.id;

ALTER TABLE affiliate_referrals
  ADD COLUMN IF NOT EXISTS activation_bonus_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS revenue_share_enabled boolean NOT NULL DEFAULT true;

-- Referral terms are immutable snapshots. Derive flags from their already-saved terms
-- without changing a historical amount, duration, attribution, or commission.
UPDATE affiliate_referrals
SET activation_bonus_enabled = activation_bonus_cents > 0,
    revenue_share_enabled = revenue_share_basis_points > 0 AND revenue_share_duration_months > 0;

ALTER TABLE creator_campaign_payments
  ADD COLUMN IF NOT EXISTS is_compensation_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS creator_campaign_default_affiliate_key
  ON creator_campaign_payments(affiliate_id)
  WHERE is_compensation_default = true;
