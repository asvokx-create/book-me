ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_mode text
    CHECK (stripe_connect_mode IS NULL OR stripe_connect_mode IN ('test', 'live')),
  ADD COLUMN IF NOT EXISTS stripe_billing_mode text
    CHECK (stripe_billing_mode IS NULL OR stripe_billing_mode IN ('test', 'live'));

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_mode text
    CHECK (stripe_mode IS NULL OR stripe_mode IN ('test', 'live'));

UPDATE provider_profiles
SET stripe_connect_mode = 'test'
WHERE stripe_account_id IS NOT NULL AND stripe_connect_mode IS NULL;

UPDATE provider_profiles
SET stripe_billing_mode = 'test'
WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
  AND stripe_billing_mode IS NULL;

-- Test subscriptions must never unlock paid features after the live launch.
UPDATE provider_profiles
SET plan = 'starter'
WHERE stripe_billing_mode = 'test'
  AND stripe_subscription_id IS NOT NULL
  AND plan IN ('pro', 'business');

UPDATE bookings
SET stripe_mode = 'test'
WHERE (stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL)
  AND stripe_mode IS NULL;
