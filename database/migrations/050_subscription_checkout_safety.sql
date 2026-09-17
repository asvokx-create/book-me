ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_checkout_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS provider_profiles_subscription_checkout_session_key
  ON provider_profiles(stripe_subscription_checkout_session_id)
  WHERE stripe_subscription_checkout_session_id IS NOT NULL;
