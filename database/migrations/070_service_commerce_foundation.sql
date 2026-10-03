-- Service-commerce foundation. Every paid occurrence continues to use the existing
-- bookings payment, refund, dispute, transfer, and affiliate-commission pipeline.

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS recurrence_options text[] NOT NULL DEFAULT ARRAY['one_time']::text[],
  ADD COLUMN IF NOT EXISTS service_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS preparation_notes text NOT NULL DEFAULT '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='services_service_kind_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_service_kind_check CHECK (service_kind IN ('standard','consultation'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='services_recurrence_options_check') THEN
    ALTER TABLE services ADD CONSTRAINT services_recurrence_options_check CHECK (
      cardinality(recurrence_options) BETWEEN 1 AND 4
      AND recurrence_options <@ ARRAY['one_time','weekly','biweekly','monthly']::text[]
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  price_cents integer NOT NULL CHECK (price_cents >= 50),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  delivery_days integer CHECK (delivery_days IS NULL OR delivery_days BETWEEN 0 AND 365),
  revision_count integer CHECK (revision_count IS NULL OR revision_count BETWEEN 0 AND 100),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, sort_order)
);

CREATE TABLE IF NOT EXISTS service_add_ons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  additional_minutes integer NOT NULL DEFAULT 0 CHECK (additional_minutes BETWEEN 0 AND 43200),
  allows_quantity boolean NOT NULL DEFAULT false,
  max_quantity integer NOT NULL DEFAULT 1 CHECK (max_quantity BETWEEN 1 AND 20),
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, sort_order)
);

CREATE TABLE IF NOT EXISTS provider_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  minimum_subtotal_cents integer NOT NULL DEFAULT 0 CHECK (minimum_subtotal_cents >= 0),
  first_booking_only boolean NOT NULL DEFAULT false,
  repeat_customer_only boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_coupons_code_key ON provider_coupons(provider_id, upper(code));

CREATE TABLE IF NOT EXISTS recurring_booking_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','cancelled','completed')),
  starts_at timestamptz NOT NULL,
  next_occurrence_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  cancelled_by text REFERENCES "user"(id) ON DELETE SET NULL,
  cancellation_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS base_price_cents integer,
  ADD COLUMN IF NOT EXISTS add_on_total_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS add_on_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES provider_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code_snapshot text,
  ADD COLUMN IF NOT EXISTS recurring_series_id uuid REFERENCES recurring_booking_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_index integer,
  ADD COLUMN IF NOT EXISTS booking_kind text NOT NULL DEFAULT 'service';

UPDATE bookings SET base_price_cents = price_cents WHERE base_price_cents IS NULL;
ALTER TABLE bookings ALTER COLUMN base_price_cents SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_commerce_amounts_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_commerce_amounts_check CHECK (
      base_price_cents >= 0 AND add_on_total_cents >= 0 AND discount_cents >= 0
      AND price_cents = GREATEST(0, base_price_cents + add_on_total_cents - discount_cents)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_booking_kind_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_booking_kind_check CHECK (booking_kind IN ('service','consultation','milestone'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_recurring_occurrence_key
  ON bookings(recurring_series_id, recurrence_index) WHERE recurring_series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recurring_series_due_idx ON recurring_booking_series(status, next_occurrence_at);
CREATE INDEX IF NOT EXISTS service_packages_active_idx ON service_packages(service_id, sort_order) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS service_add_ons_active_idx ON service_add_ons(service_id, sort_order) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS provider_coupons_lookup_idx ON provider_coupons(provider_id, upper(code)) WHERE is_active=true;

CREATE TABLE IF NOT EXISTS provider_repeat_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_repeat_offers_recent_idx ON provider_repeat_offers(provider_id, customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_recommendation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  service_context text NOT NULL DEFAULT '' CHECK (char_length(service_context) <= 120),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_recommendation_requests_provider_idx ON provider_recommendation_requests(provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL UNIQUE REFERENCES provider_recommendation_requests(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  relationship text NOT NULL CHECK (char_length(relationship) BETWEEN 2 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 1500),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','hidden','rejected')),
  moderated_at timestamptz,
  moderated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_recommendations_public_idx ON provider_recommendations(provider_id, created_at DESC) WHERE moderation_status='approved';

DROP TRIGGER IF EXISTS service_packages_set_updated_at ON service_packages;
CREATE TRIGGER service_packages_set_updated_at BEFORE UPDATE ON service_packages FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS service_add_ons_set_updated_at ON service_add_ons;
CREATE TRIGGER service_add_ons_set_updated_at BEFORE UPDATE ON service_add_ons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS provider_coupons_set_updated_at ON provider_coupons;
CREATE TRIGGER provider_coupons_set_updated_at BEFORE UPDATE ON provider_coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS recurring_booking_series_set_updated_at ON recurring_booking_series;
CREATE TRIGGER recurring_booking_series_set_updated_at BEFORE UPDATE ON recurring_booking_series FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS provider_recommendations_set_updated_at ON provider_recommendations;
CREATE TRIGGER provider_recommendations_set_updated_at BEFORE UPDATE ON provider_recommendations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
