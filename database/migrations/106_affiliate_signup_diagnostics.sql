-- Privacy-minimized affiliate signup diagnostics. No IP addresses, full user
-- agents, passwords, dates of birth, email addresses, or form values are stored.
ALTER TABLE affiliate_clicks
  ADD COLUMN IF NOT EXISTS signup_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS browser_category text;

ALTER TABLE affiliate_click_events
  ADD COLUMN IF NOT EXISTS device_category text,
  ADD COLUMN IF NOT EXISTS browser_category text;

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_clicks_account_user_unique_idx
  ON affiliate_clicks(account_user_id)
  WHERE account_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS affiliate_clicks_signup_submitted_idx
  ON affiliate_clicks(affiliate_id, signup_submitted_at DESC)
  WHERE signup_submitted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS affiliate_signup_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id uuid NOT NULL REFERENCES affiliate_clicks(id) ON DELETE RESTRICT,
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE RESTRICT,
  auth_method text NOT NULL CHECK (auth_method IN ('email', 'google', 'unknown')),
  failure_category text NOT NULL CHECK (failure_category IN (
    'age_eligibility', 'agreement', 'location', 'validation', 'account_exists',
    'rate_limited', 'oauth', 'network', 'authentication', 'unknown'
  )),
  device_category text NOT NULL,
  browser_category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_signup_failures_affiliate_created_idx
  ON affiliate_signup_failures(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_signup_failures_click_created_idx
  ON affiliate_signup_failures(click_id, created_at DESC);
