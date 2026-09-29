CREATE TABLE IF NOT EXISTS creator_campaign_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  program_id uuid REFERENCES affiliate_programs(id) ON DELETE SET NULL,
  campaign_name text NOT NULL,
  fixed_amount_cents integer NOT NULL CHECK (fixed_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = 'usd'),
  payment_status text NOT NULL DEFAULT 'planned' CHECK (payment_status IN ('planned','approved','paid','cancelled')),
  campaign_starts_on date,
  campaign_ends_on date,
  affiliate_code text,
  revenue_share_basis_points integer CHECK (revenue_share_basis_points BETWEEN 0 AND 10000),
  revenue_share_duration_months integer CHECK (revenue_share_duration_months >= 0),
  notes text NOT NULL DEFAULT '',
  payment_reference text,
  paid_at timestamptz,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (campaign_ends_on IS NULL OR campaign_starts_on IS NULL OR campaign_ends_on >= campaign_starts_on)
);

CREATE INDEX IF NOT EXISTS creator_campaign_payments_affiliate_idx
  ON creator_campaign_payments(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_campaign_payments_status_idx
  ON creator_campaign_payments(payment_status, created_at DESC);

DROP TRIGGER IF EXISTS creator_campaign_payments_set_updated_at ON creator_campaign_payments;
CREATE TRIGGER creator_campaign_payments_set_updated_at
  BEFORE UPDATE ON creator_campaign_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
