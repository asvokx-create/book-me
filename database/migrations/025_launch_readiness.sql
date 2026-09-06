ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none'
    CHECK (refund_status IN ('none', 'requested', 'processing', 'refunded', 'rejected', 'failed')),
  ADD COLUMN IF NOT EXISTS refund_requested_by text REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer CHECK (refund_amount_cents IS NULL OR refund_amount_cents > 0),
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  ADD COLUMN IF NOT EXISTS stripe_refund_id text,
  ADD COLUMN IF NOT EXISTS refund_failure_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_stripe_refund_key
  ON bookings(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  anonymous_id text,
  path text,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_created_idx
  ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON analytics_events(user_id, created_at DESC);

