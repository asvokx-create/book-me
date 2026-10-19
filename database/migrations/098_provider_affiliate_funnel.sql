-- Additive, privacy-minimized provider funnel milestones for affiliate visits.
-- Existing clicks, referrals, commission snapshots, and payout records are not
-- rewritten. COALESCE updates in application code keep each milestone first-touch.
ALTER TABLE affiliate_clicks
  ADD COLUMN IF NOT EXISTS signup_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS company_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_listing_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_listing_published_at timestamptz;

CREATE INDEX IF NOT EXISTS affiliate_clicks_signup_started_idx
  ON affiliate_clicks(affiliate_id, signup_started_at DESC)
  WHERE signup_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS affiliate_clicks_listing_published_idx
  ON affiliate_clicks(affiliate_id, first_listing_published_at DESC)
  WHERE first_listing_published_at IS NOT NULL;
