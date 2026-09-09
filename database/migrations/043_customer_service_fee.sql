ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_service_fee_cents integer NOT NULL DEFAULT 0
    CHECK (customer_service_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS customer_service_fee_refunded_cents integer NOT NULL DEFAULT 0
    CHECK (customer_service_fee_refunded_cents >= 0);

