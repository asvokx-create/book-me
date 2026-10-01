-- Existing BubsBookings listings were created through a local-only flow with a
-- required service location and radius. They are therefore classified as
-- IN_PERSON. Providers can explicitly change them to REMOTE or BOTH afterward.
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN IF NOT EXISTS remote_delivery_details text NOT NULL DEFAULT '';

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_delivery_type_check;
ALTER TABLE services ADD CONSTRAINT services_delivery_type_check
  CHECK (delivery_type IN ('IN_PERSON', 'REMOTE', 'BOTH'));
ALTER TABLE services ALTER COLUMN location_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS services_delivery_category_status_idx
  ON services(delivery_type, lower(category), is_active);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_delivery_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_delivery_method_check
  CHECK (delivery_method IN ('IN_PERSON', 'REMOTE'));
CREATE INDEX IF NOT EXISTS bookings_delivery_status_idx
  ON bookings(delivery_method, status, created_at DESC);

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE job_requests DROP CONSTRAINT IF EXISTS job_requests_delivery_type_check;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_delivery_type_check
  CHECK (delivery_type IN ('IN_PERSON', 'REMOTE', 'EITHER'));
ALTER TABLE job_requests ALTER COLUMN service_address_line1 DROP NOT NULL;
ALTER TABLE job_requests ALTER COLUMN city DROP NOT NULL;
ALTER TABLE job_requests ALTER COLUMN state DROP NOT NULL;
ALTER TABLE job_requests ALTER COLUMN postal_code DROP NOT NULL;
ALTER TABLE job_requests ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE job_requests ALTER COLUMN longitude DROP NOT NULL;
CREATE INDEX IF NOT EXISTS job_requests_delivery_category_status_idx
  ON job_requests(delivery_type, lower(category), status, created_at DESC);

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS delivery_method text;
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_delivery_method_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_delivery_method_check
  CHECK (delivery_method IS NULL OR delivery_method IN ('IN_PERSON', 'REMOTE'));

COMMENT ON COLUMN services.delivery_type IS
  'Structured fulfillment mode. Existing location-backed listings migrated as IN_PERSON.';
COMMENT ON COLUMN bookings.delivery_method IS
  'Immutable booking-time snapshot of the customer-selected fulfillment method.';
