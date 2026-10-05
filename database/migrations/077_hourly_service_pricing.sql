-- End-to-end hourly service pricing. Existing services remain fixed-price.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer,
  ADD COLUMN IF NOT EXISTS minimum_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS maximum_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS billing_increment_minutes integer,
  ADD COLUMN IF NOT EXISTS default_duration_minutes integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='services_pricing_type_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_pricing_type_check
      CHECK (pricing_type IN ('FIXED','HOURLY'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='services_hourly_pricing_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_hourly_pricing_check CHECK (
      (pricing_type='FIXED' AND hourly_rate_cents IS NULL AND minimum_duration_minutes IS NULL
        AND maximum_duration_minutes IS NULL AND billing_increment_minutes IS NULL
        AND default_duration_minutes IS NULL)
      OR
      (pricing_type='HOURLY' AND hourly_rate_cents >= 50
        AND billing_increment_minutes IN (15,30,60)
        AND minimum_duration_minutes >= billing_increment_minutes
        AND minimum_duration_minutes % billing_increment_minutes = 0
        AND default_duration_minutes >= minimum_duration_minutes
        AND default_duration_minutes % billing_increment_minutes = 0
        AND (maximum_duration_minutes IS NULL OR (
          maximum_duration_minutes >= default_duration_minutes
          AND maximum_duration_minutes % billing_increment_minutes = 0
        )))
    );
  END IF;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pricing_type_snapshot text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS hourly_rate_cents_snapshot integer,
  ADD COLUMN IF NOT EXISTS billable_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS billing_increment_minutes_snapshot integer,
  ADD COLUMN IF NOT EXISTS minimum_duration_minutes_snapshot integer,
  ADD COLUMN IF NOT EXISTS maximum_duration_minutes_snapshot integer,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS quoted_pricing_type text,
  ADD COLUMN IF NOT EXISTS quoted_hourly_rate_cents integer,
  ADD COLUMN IF NOT EXISTS quoted_duration_minutes integer;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS hourly_rate_cents integer,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

UPDATE bookings
SET billable_duration_minutes = GREATEST(1, round(EXTRACT(EPOCH FROM (ends_at-starts_at))/60)::integer)
WHERE billable_duration_minutes IS NULL;

ALTER TABLE bookings ALTER COLUMN billable_duration_minutes SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_pricing_type_snapshot_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_pricing_type_snapshot_check
      CHECK (pricing_type_snapshot IN ('FIXED','HOURLY'));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_hourly_snapshot_check') THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_hourly_snapshot_check;
  END IF;
  ALTER TABLE bookings ADD CONSTRAINT bookings_hourly_snapshot_check CHECK (
    billable_duration_minutes > 0
    AND (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0)
    AND (
      (pricing_type_snapshot='FIXED' AND hourly_rate_cents_snapshot IS NULL
        AND billing_increment_minutes_snapshot IS NULL AND minimum_duration_minutes_snapshot IS NULL
        AND maximum_duration_minutes_snapshot IS NULL)
      OR
      (pricing_type_snapshot='HOURLY' AND hourly_rate_cents_snapshot >= 50
        AND billing_increment_minutes_snapshot IN (15,30,60)
        AND minimum_duration_minutes_snapshot >= billing_increment_minutes_snapshot
        AND billable_duration_minutes >= minimum_duration_minutes_snapshot
        AND billable_duration_minutes % billing_increment_minutes_snapshot = 0
        AND (maximum_duration_minutes_snapshot IS NULL OR billable_duration_minutes <= maximum_duration_minutes_snapshot))
    )
  );
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_quoted_hourly_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_quoted_hourly_check CHECK (
      quoted_pricing_type IS NULL OR quoted_pricing_type='FIXED' OR
      (quoted_pricing_type='HOURLY' AND quoted_hourly_rate_cents >= 50 AND quoted_duration_minutes > 0)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='quotes_pricing_snapshot_check') THEN
    ALTER TABLE quotes ADD CONSTRAINT quotes_pricing_snapshot_check CHECK (
      (pricing_type='FIXED' AND hourly_rate_cents IS NULL)
      OR (pricing_type='HOURLY' AND hourly_rate_cents >= 50 AND duration_minutes > 0)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS services_pricing_type_idx ON services(pricing_type) WHERE is_active=true;

CREATE TABLE IF NOT EXISTS booking_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  requested_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  change_type text NOT NULL CHECK (change_type IN ('duration_increase','duration_decrease')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  original_duration_minutes integer NOT NULL CHECK (original_duration_minutes > 0),
  requested_duration_minutes integer NOT NULL CHECK (requested_duration_minutes > 0),
  original_service_subtotal_cents integer NOT NULL CHECK (original_service_subtotal_cents >= 0),
  requested_service_subtotal_cents integer NOT NULL CHECK (requested_service_subtotal_cents >= 0),
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 500),
  responded_by text REFERENCES "user"(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS booking_change_requests_pending_key
  ON booking_change_requests(booking_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS booking_change_requests_booking_idx
  ON booking_change_requests(booking_id, created_at DESC);

DROP TRIGGER IF EXISTS booking_change_requests_set_updated_at ON booking_change_requests;
CREATE TRIGGER booking_change_requests_set_updated_at BEFORE UPDATE ON booking_change_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
