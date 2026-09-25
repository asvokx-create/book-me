CREATE TABLE IF NOT EXISTS affiliate_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  activation_bonus_cents integer NOT NULL DEFAULT 1000 CHECK (activation_bonus_cents >= 0),
  revenue_share_basis_points integer NOT NULL DEFAULT 2000 CHECK (revenue_share_basis_points BETWEEN 0 AND 10000),
  revenue_share_duration_months integer NOT NULL DEFAULT 6 CHECK (revenue_share_duration_months >= 0),
  revenue_share_starts_at text NOT NULL DEFAULT 'qualified' CHECK (revenue_share_starts_at IN ('provider_signup', 'qualified', 'first_completed_booking')),
  attribution_window_days integer NOT NULL DEFAULT 60 CHECK (attribution_window_days BETWEEN 1 AND 365),
  hold_period_days integer NOT NULL DEFAULT 30 CHECK (hold_period_days BETWEEN 0 AND 365),
  minimum_payout_cents integer NOT NULL DEFAULT 5000 CHECK (minimum_payout_cents >= 0),
  payout_schedule text NOT NULL DEFAULT 'manual' CHECK (payout_schedule IN ('manual', 'monthly')),
  eligible_provider_plans text[] NOT NULL DEFAULT ARRAY['starter','pro','business','owner']::text[],
  eligible_revenue_types text[] NOT NULL DEFAULT ARRAY['provider_marketplace_fee']::text[],
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('draft', 'enabled', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO affiliate_programs (name, description)
VALUES ('Standard Creator Program', 'Earn for qualified new providers and a share of eligible BubsBookings provider marketplace revenue.')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS affiliate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text UNIQUE REFERENCES "user"(id) ON DELETE SET NULL,
  program_id uuid REFERENCES affiliate_programs(id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  legal_name text,
  email text NOT NULL,
  phone text,
  website_url text,
  youtube_url text,
  instagram_url text,
  tiktok_url text,
  x_url text,
  facebook_url text,
  other_social_url text,
  audience_size text,
  primary_audience text NOT NULL DEFAULT '',
  promotion_plan text NOT NULL DEFAULT '',
  applicant_notes text NOT NULL DEFAULT '',
  admin_notes text NOT NULL DEFAULT '',
  affiliate_code text UNIQUE,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','under_review','approved','active','paused','rejected','suspended','terminated')),
  payment_status text NOT NULL DEFAULT 'not_ready' CHECK (payment_status IN ('not_ready','ready','on_hold')),
  tax_onboarding_status text NOT NULL DEFAULT 'not_started' CHECK (tax_onboarding_status IN ('not_started','pending','complete','requires_attention')),
  activation_bonus_override_cents integer CHECK (activation_bonus_override_cents >= 0),
  revenue_share_override_basis_points integer CHECK (revenue_share_override_basis_points BETWEEN 0 AND 10000),
  revenue_share_duration_override_months integer CHECK (revenue_share_duration_override_months >= 0),
  minimum_payout_override_cents integer CHECK (minimum_payout_override_cents >= 0),
  applied_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_profiles_email_key ON affiliate_profiles(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_profiles_code_key ON affiliate_profiles(lower(affiliate_code)) WHERE affiliate_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE RESTRICT,
  attribution_token uuid NOT NULL,
  affiliate_code text NOT NULL,
  landing_path text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_clicks_affiliate_created_idx ON affiliate_clicks(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_clicks_token_idx ON affiliate_clicks(attribution_token);

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL UNIQUE REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  click_id uuid REFERENCES affiliate_clicks(id) ON DELETE SET NULL,
  program_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE RESTRICT,
  attribution_source text NOT NULL CHECK (attribution_source IN ('cookie','manual','admin')),
  attributed_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up','onboarding_completed','listing_published','first_booking_paid','first_booking_completed','qualified','revenue_share_ended','disqualified')),
  activation_bonus_cents integer NOT NULL CHECK (activation_bonus_cents >= 0),
  revenue_share_basis_points integer NOT NULL CHECK (revenue_share_basis_points BETWEEN 0 AND 10000),
  revenue_share_duration_months integer NOT NULL CHECK (revenue_share_duration_months >= 0),
  revenue_share_starts_at text NOT NULL CHECK (revenue_share_starts_at IN ('provider_signup','qualified','first_completed_booking')),
  attribution_window_days integer NOT NULL CHECK (attribution_window_days BETWEEN 1 AND 365),
  hold_period_days integer NOT NULL CHECK (hold_period_days BETWEEN 0 AND 365),
  minimum_payout_cents integer NOT NULL CHECK (minimum_payout_cents >= 0),
  eligible_provider_plans text[] NOT NULL,
  eligible_revenue_types text[] NOT NULL,
  qualified_at timestamptz,
  first_completed_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  revenue_share_started_at timestamptz,
  revenue_share_ends_at timestamptz,
  disqualification_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_referrals_affiliate_idx ON affiliate_referrals(affiliate_id, attributed_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  referral_id uuid NOT NULL REFERENCES affiliate_referrals(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES bookings(id) ON DELETE RESTRICT,
  payment_reference text,
  commission_type text NOT NULL CHECK (commission_type IN ('activation_bonus','revenue_share','manual_adjustment','reversal','bonus')),
  eligible_revenue_cents integer NOT NULL DEFAULT 0,
  commission_rate_basis_points integer,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','hold','approved','payable','paid','reversed','rejected','disputed')),
  eligible_at timestamptz,
  approved_at timestamptz,
  payable_at timestamptz,
  paid_at timestamptz,
  reversal_reason text,
  admin_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commission_booking_type_key ON affiliate_commissions(booking_id, commission_type) WHERE booking_id IS NOT NULL AND commission_type IN ('activation_bonus','revenue_share');
CREATE UNIQUE INDEX IF NOT EXISTS affiliate_commission_activation_referral_key ON affiliate_commissions(referral_id) WHERE commission_type = 'activation_bonus';
CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_status_idx ON affiliate_commissions(affiliate_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','reversed')),
  payout_method text NOT NULL DEFAULT 'manual',
  payout_reference text,
  failure_reason text,
  initiated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS affiliate_payout_commissions (
  payout_id uuid NOT NULL REFERENCES affiliate_payouts(id) ON DELETE RESTRICT,
  commission_id uuid NOT NULL UNIQUE REFERENCES affiliate_commissions(id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL,
  PRIMARY KEY (payout_id, commission_id)
);

CREATE TABLE IF NOT EXISTS affiliate_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_audit_created_idx ON affiliate_audit_log(created_at DESC);

DROP TRIGGER IF EXISTS affiliate_programs_set_updated_at ON affiliate_programs;
CREATE TRIGGER affiliate_programs_set_updated_at BEFORE UPDATE ON affiliate_programs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS affiliate_profiles_set_updated_at ON affiliate_profiles;
CREATE TRIGGER affiliate_profiles_set_updated_at BEFORE UPDATE ON affiliate_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS affiliate_referrals_set_updated_at ON affiliate_referrals;
CREATE TRIGGER affiliate_referrals_set_updated_at BEFORE UPDATE ON affiliate_referrals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS affiliate_commissions_set_updated_at ON affiliate_commissions;
CREATE TRIGGER affiliate_commissions_set_updated_at BEFORE UPDATE ON affiliate_commissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS affiliate_payouts_set_updated_at ON affiliate_payouts;
CREATE TRIGGER affiliate_payouts_set_updated_at BEFORE UPDATE ON affiliate_payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
