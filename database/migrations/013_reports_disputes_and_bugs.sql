ALTER TABLE safety_reports
  ALTER COLUMN conversation_id DROP NOT NULL;

ALTER TABLE safety_reports
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS safety_reports_open_conversation_reporter_key;

CREATE UNIQUE INDEX IF NOT EXISTS safety_reports_open_conversation_reporter_key
  ON safety_reports(conversation_id, reporter_id)
  WHERE conversation_id IS NOT NULL AND status IN ('open', 'reviewing');

CREATE UNIQUE INDEX IF NOT EXISTS safety_reports_open_booking_reporter_key
  ON safety_reports(booking_id, reporter_id)
  WHERE booking_id IS NOT NULL AND status IN ('open', 'reviewing');

CREATE TABLE IF NOT EXISTS booking_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  opened_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  against_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('service_quality', 'no_show', 'damage', 'billing', 'other')),
  details text NOT NULL,
  requested_resolution text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_disputes_open_booking_reporter_key
  ON booking_disputes(booking_id, opened_by)
  WHERE status IN ('open', 'reviewing');

CREATE INDEX IF NOT EXISTS booking_disputes_status_created_idx
  ON booking_disputes(status, created_at DESC);

CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  page_url text NOT NULL DEFAULT '',
  title text NOT NULL,
  details text NOT NULL,
  steps_to_reproduce text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_status_created_idx
  ON bug_reports(status, created_at DESC);

DROP TRIGGER IF EXISTS booking_disputes_set_updated_at ON booking_disputes;
CREATE TRIGGER booking_disputes_set_updated_at
BEFORE UPDATE ON booking_disputes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bug_reports_set_updated_at ON bug_reports;
CREATE TRIGGER bug_reports_set_updated_at
BEFORE UPDATE ON bug_reports
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
