ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_mode text CHECK (stripe_connect_mode IN ('test','live')),
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_requirements_due text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_profiles_stripe_account_key
  ON affiliate_profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

ALTER TABLE affiliate_payouts
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_mode text CHECK (stripe_mode IN ('test','live')),
  ADD COLUMN IF NOT EXISTS stripe_attempt_count integer NOT NULL DEFAULT 1 CHECK (stripe_attempt_count > 0),
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_payouts_stripe_transfer_key
  ON affiliate_payouts(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
