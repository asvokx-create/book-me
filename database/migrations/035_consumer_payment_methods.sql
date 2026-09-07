ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS consumer_stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS consumer_stripe_mode text
    CHECK (consumer_stripe_mode IS NULL OR consumer_stripe_mode IN ('test', 'live'));

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_consumer_stripe_customer_key
  ON user_settings(consumer_stripe_customer_id)
  WHERE consumer_stripe_customer_id IS NOT NULL;
