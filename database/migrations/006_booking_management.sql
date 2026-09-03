ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_provider_id_idx ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS reviews_service_id_idx ON reviews(service_id);

DROP TRIGGER IF EXISTS reviews_set_updated_at ON reviews;
CREATE TRIGGER reviews_set_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO conversations (customer_id, provider_id, service_id)
SELECT DISTINCT ON (b.customer_id, b.provider_id)
  b.customer_id, b.provider_id, b.service_id
FROM bookings b
ORDER BY b.customer_id, b.provider_id, b.created_at DESC
ON CONFLICT (customer_id, provider_id) DO NOTHING;
