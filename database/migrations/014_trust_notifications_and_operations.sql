ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS cancellation_window_hours integer NOT NULL DEFAULT 24
    CHECK (cancellation_window_hours BETWEEN 0 AND 168),
  ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT
    'Cancel at least 24 hours before the appointment whenever possible.',
  ADD COLUMN IF NOT EXISTS no_show_policy text NOT NULL DEFAULT
    'If you cannot attend, contact the other person as soon as possible. Repeated no-shows may be reported to BubsBookings.';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  recipient text NOT NULL,
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  error_message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_log_created_idx
  ON email_delivery_log(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS email_delivery_log_booking_type_key
  ON email_delivery_log(booking_id, user_id, email_type)
  WHERE booking_id IS NOT NULL AND user_id IS NOT NULL AND status = 'sent';

CREATE TABLE IF NOT EXISTS operations_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operations_checks_created_idx
  ON operations_checks(created_at DESC);
