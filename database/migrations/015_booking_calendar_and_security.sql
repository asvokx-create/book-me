ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reschedule_requested_by text,
  ADD COLUMN IF NOT EXISTS reschedule_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_reason text,
  ADD COLUMN IF NOT EXISTS reschedule_requested_at timestamptz;

CREATE TABLE IF NOT EXISTS booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_events_booking_created_idx
  ON booking_events(booking_id, created_at DESC);

INSERT INTO booking_events (booking_id, actor_user_id, event_type, message, created_at)
SELECT b.id, b.customer_id, 'requested', 'Customer sent the booking request.', b.created_at
FROM bookings b
WHERE NOT EXISTS (SELECT 1 FROM booking_events event WHERE event.booking_id = b.id);

CREATE TABLE IF NOT EXISTS request_rate_limits (
  bucket text NOT NULL,
  identifier_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, identifier_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS request_rate_limits_window_idx
  ON request_rate_limits(window_started_at);

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_user_idx ON activity_log(user_id, created_at DESC);
