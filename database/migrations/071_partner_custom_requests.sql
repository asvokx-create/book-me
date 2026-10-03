ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS custom_partnership_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_partnership_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS active_platforms text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS promotion_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS follower_count integer CHECK (follower_count IS NULL OR follower_count >= 0),
  ADD COLUMN IF NOT EXISTS subscriber_count integer CHECK (subscriber_count IS NULL OR subscriber_count >= 0),
  ADD COLUMN IF NOT EXISTS email_list_size integer CHECK (email_list_size IS NULL OR email_list_size >= 0),
  ADD COLUMN IF NOT EXISTS monthly_website_traffic integer CHECK (monthly_website_traffic IS NULL OR monthly_website_traffic >= 0),
  ADD COLUMN IF NOT EXISTS average_content_views integer CHECK (average_content_views IS NULL OR average_content_views >= 0),
  ADD COLUMN IF NOT EXISTS other_audience_size text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS media_kit_url text,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS custom_partnership_notes text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS affiliate_profiles_custom_request_review_idx
  ON affiliate_profiles(custom_partnership_requested, applied_at DESC)
  WHERE custom_partnership_requested = true AND status IN ('applied','under_review');
