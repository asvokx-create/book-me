ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_release_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (payment_release_status IN (
      'not_applicable', 'awaiting_payment', 'secured', 'awaiting_customer',
      'processing', 'paid_out', 'partially_released', 'frozen', 'reversed', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS payment_flow text,
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS provider_payout_cents integer NOT NULL DEFAULT 0 CHECK (provider_payout_cents >= 0),
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_reversed_cents integer NOT NULL DEFAULT 0 CHECK (stripe_transfer_reversed_cents >= 0),
  ADD COLUMN IF NOT EXISTS completion_confirmation_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_failure_reason text,
  ADD COLUMN IF NOT EXISTS payout_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_frozen_by text REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payout_freeze_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_charge_key
  ON bookings(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_transfer_key
  ON bookings(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_due_payout_idx
  ON bookings(completion_confirmation_due_at)
  WHERE payment_release_status = 'awaiting_customer';

-- Payments created before held transfers were introduced already sent their provider share.
UPDATE bookings
SET payment_release_status = 'paid_out',
    payout_released_at = COALESCE(paid_at, now()),
    payment_flow = COALESCE(payment_flow, 'legacy_destination_charge')
WHERE payment_status = 'paid'
  AND payment_release_status = 'not_applicable';
