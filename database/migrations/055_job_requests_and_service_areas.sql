CREATE TABLE IF NOT EXISTS provider_location_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES provider_locations(id) ON DELETE CASCADE,
  area_type text NOT NULL CHECK (area_type IN ('city', 'zip')),
  normalized_value text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, area_type, normalized_value)
);

CREATE INDEX IF NOT EXISTS provider_location_service_areas_lookup_idx
  ON provider_location_service_areas(area_type, normalized_value);

CREATE TABLE IF NOT EXISTS job_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 3000),
  service_address_line1 text NOT NULL,
  service_address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  postal_code text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  preferred_starts_at timestamptz NOT NULL,
  is_flexible boolean NOT NULL DEFAULT false,
  budget_min_cents integer CHECK (budget_min_cents IS NULL OR budget_min_cents >= 0),
  budget_max_cents integer CHECK (budget_max_cents IS NULL OR budget_max_cents >= budget_min_cents),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'receiving_responses', 'quote_accepted', 'booking_created', 'closed', 'expired', 'cancelled')),
  accepted_quote_id uuid,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_requests_customer_created_idx ON job_requests(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_requests_status_created_idx ON job_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_request_matches (
  request_id uuid NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  distance_miles double precision NOT NULL,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'viewed', 'responded', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, provider_id)
);

CREATE INDEX IF NOT EXISTS job_request_matches_provider_idx ON job_request_matches(provider_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  job_request_id uuid REFERENCES job_requests(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_cents integer NOT NULL CHECK (total_cents > 0),
  notes text NOT NULL DEFAULT '',
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'superseded')),
  supersedes_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_request_id, provider_id, version)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_requests_accepted_quote_fk'
  ) THEN
    ALTER TABLE job_requests
      ADD CONSTRAINT job_requests_accepted_quote_fk
      FOREIGN KEY (accepted_quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source_job_request_id uuid REFERENCES job_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_source_quote_key
  ON bookings(source_quote_id) WHERE source_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotes_customer_created_idx ON quotes(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_provider_created_idx ON quotes(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_job_request_idx ON quotes(job_request_id, created_at DESC);

DROP TRIGGER IF EXISTS job_requests_set_updated_at ON job_requests;
CREATE TRIGGER job_requests_set_updated_at
BEFORE UPDATE ON job_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS quotes_set_updated_at ON quotes;
CREATE TRIGGER quotes_set_updated_at
BEFORE UPDATE ON quotes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
