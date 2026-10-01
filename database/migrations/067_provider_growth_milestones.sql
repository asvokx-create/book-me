ALTER TABLE affiliate_programs
  ADD COLUMN IF NOT EXISTS milestone_bonuses_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_provider_required_bookings integer NOT NULL DEFAULT 4
    CHECK (active_provider_required_bookings = 4),
  ADD COLUMN IF NOT EXISTS milestone_thresholds integer[] NOT NULL DEFAULT ARRAY[10,25,50,100]::integer[],
  ADD COLUMN IF NOT EXISTS milestone_bonus_cents integer[] NOT NULL DEFAULT ARRAY[5000,10000,25000,50000]::integer[];

ALTER TABLE affiliate_programs DROP CONSTRAINT IF EXISTS affiliate_programs_milestone_config_check;
ALTER TABLE affiliate_programs ADD CONSTRAINT affiliate_programs_milestone_config_check CHECK (
  cardinality(milestone_thresholds) = cardinality(milestone_bonus_cents)
  AND cardinality(milestone_thresholds) > 0
  AND 0 < ALL(milestone_thresholds)
  AND 0 <= ALL(milestone_bonus_cents)
);

UPDATE affiliate_programs
SET milestone_bonuses_enabled = true,
    active_provider_required_bookings = 4,
    milestone_thresholds = ARRAY[10,25,50,100]::integer[],
    milestone_bonus_cents = ARRAY[5000,10000,25000,50000]::integer[]
WHERE name = 'Standard Creator Program';

ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS milestone_bonuses_override boolean,
  ADD COLUMN IF NOT EXISTS milestone_backfill_approved boolean;

-- Existing partners require an administrator to review historical liability first.
UPDATE affiliate_profiles SET milestone_backfill_approved = false WHERE milestone_backfill_approved IS NULL;
ALTER TABLE affiliate_profiles ALTER COLUMN milestone_backfill_approved SET DEFAULT true;
ALTER TABLE affiliate_profiles ALTER COLUMN milestone_backfill_approved SET NOT NULL;

ALTER TABLE affiliate_referrals
  ADD COLUMN IF NOT EXISTS milestone_bonuses_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_provider_required_bookings integer NOT NULL DEFAULT 4
    CHECK (active_provider_required_bookings = 4);

UPDATE affiliate_referrals referral
SET milestone_bonuses_enabled = program.milestone_bonuses_enabled,
    active_provider_required_bookings = program.active_provider_required_bookings
FROM affiliate_programs program
WHERE program.id = referral.program_id;

ALTER TABLE affiliate_commissions DROP CONSTRAINT IF EXISTS affiliate_commissions_commission_type_check;
ALTER TABLE affiliate_commissions ADD CONSTRAINT affiliate_commissions_commission_type_check
  CHECK (commission_type IN ('activation_bonus','revenue_share','milestone_bonus','manual_adjustment','reversal','bonus'));

CREATE TABLE IF NOT EXISTS affiliate_milestone_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  commission_id uuid UNIQUE REFERENCES affiliate_commissions(id) ON DELETE RESTRICT,
  triggering_referral_id uuid NOT NULL REFERENCES affiliate_referrals(id) ON DELETE RESTRICT,
  triggering_provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  milestone_threshold integer NOT NULL CHECK (milestone_threshold > 0),
  bonus_amount_cents integer NOT NULL CHECK (bonus_amount_cents >= 0),
  active_provider_count integer NOT NULL CHECK (active_provider_count >= milestone_threshold),
  earned_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text,
  email_sent_at timestamptz,
  email_attempt_count integer NOT NULL DEFAULT 0,
  email_last_error text,
  notification_id uuid REFERENCES notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_id, milestone_threshold)
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commission_milestone_reference_key
  ON affiliate_commissions(payment_reference)
  WHERE commission_type = 'milestone_bonus';
CREATE INDEX IF NOT EXISTS affiliate_milestone_affiliate_idx
  ON affiliate_milestone_achievements(affiliate_id, milestone_threshold);
CREATE INDEX IF NOT EXISTS affiliate_milestone_email_queue_idx
  ON affiliate_milestone_achievements(email_sent_at, created_at)
  WHERE email_sent_at IS NULL AND reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_provider_milestone_qualification_idx
  ON bookings(provider_id, payout_released_at)
  WHERE status = 'completed' AND payment_status = 'paid';

DROP TRIGGER IF EXISTS affiliate_milestone_achievements_set_updated_at ON affiliate_milestone_achievements;
CREATE TRIGGER affiliate_milestone_achievements_set_updated_at
BEFORE UPDATE ON affiliate_milestone_achievements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
