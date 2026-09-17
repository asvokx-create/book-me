ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_dispute_id text,
  ADD COLUMN IF NOT EXISTS stripe_dispute_status text,
  ADD COLUMN IF NOT EXISTS stripe_dispute_reason text,
  ADD COLUMN IF NOT EXISTS stripe_dispute_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_dispute_closed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_dispute_key
  ON bookings(stripe_dispute_id) WHERE stripe_dispute_id IS NOT NULL;
