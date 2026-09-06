ALTER TABLE services
  ADD COLUMN IF NOT EXISTS booking_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

UPDATE services s
SET city = p.city,
    state = p.state,
    latitude = p.latitude,
    longitude = p.longitude
FROM provider_profiles p
WHERE s.provider_id = p.id
  AND (s.city IS NULL OR s.state IS NULL);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS services_location_idx ON services (city, state) WHERE is_active = true;
