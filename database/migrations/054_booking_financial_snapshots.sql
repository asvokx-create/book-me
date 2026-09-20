ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS provider_plan_snapshot text,
  ADD COLUMN IF NOT EXISTS provider_fee_basis_points integer,
  ADD COLUMN IF NOT EXISTS customer_total_cents integer;

UPDATE bookings booking
SET provider_plan_snapshot = COALESCE(
      booking.provider_plan_snapshot,
      CASE
        WHEN booking.payment_flow IS NULL THEN provider.plan
        WHEN booking.price_cents > 0 AND booking.platform_fee_cents = 0 THEN 'owner'
        WHEN booking.price_cents > 0 AND round(booking.platform_fee_cents::numeric * 10000 / booking.price_cents) BETWEEN 550 AND 650 THEN 'pro'
        WHEN booking.price_cents > 0 AND round(booking.platform_fee_cents::numeric * 10000 / booking.price_cents) BETWEEN 950 AND 1050 THEN 'starter'
        ELSE provider.plan
      END
    ),
    provider_fee_basis_points = COALESCE(
      booking.provider_fee_basis_points,
      CASE WHEN booking.payment_flow IS NULL
        THEN CASE provider.plan WHEN 'pro' THEN 600 WHEN 'business' THEN 200 WHEN 'owner' THEN 0 ELSE 1000 END
        WHEN booking.price_cents > 0
        THEN round(booking.platform_fee_cents::numeric * 10000 / booking.price_cents)::integer
        ELSE CASE provider.plan WHEN 'pro' THEN 600 WHEN 'business' THEN 200 WHEN 'owner' THEN 0 ELSE 1000 END
      END
    ),
    customer_total_cents = COALESCE(booking.customer_total_cents, booking.price_cents + booking.customer_service_fee_cents)
FROM provider_profiles provider
WHERE provider.id = booking.provider_id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_provider_plan_snapshot_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_provider_plan_snapshot_check
      CHECK (provider_plan_snapshot IN ('starter', 'pro', 'business', 'owner'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_provider_fee_basis_points_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_provider_fee_basis_points_check
      CHECK (provider_fee_basis_points BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_total_cents_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_customer_total_cents_check
      CHECK (customer_total_cents >= price_cents);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_financial_review_idx
  ON bookings(payment_release_status, completion_confirmation_due_at, payment_status)
  WHERE stripe_transfer_id IS NULL;

ALTER TABLE booking_disputes DROP CONSTRAINT IF EXISTS booking_disputes_resolution_outcome_check;
ALTER TABLE booking_disputes ADD CONSTRAINT booking_disputes_resolution_outcome_check
  CHECK (resolution_outcome IS NULL OR resolution_outcome IN ('provider', 'customer', 'partial'));
