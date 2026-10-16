-- Preserve the original financial facts for every booking. Historical paid
-- transactions remain untouched; new bookings snapshot their applicable cap.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS provider_fee_cap_cents integer,
  ADD COLUMN IF NOT EXISTS stripe_processing_fee_cents integer,
  ADD COLUMN IF NOT EXISTS provider_processing_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee_status text NOT NULL DEFAULT 'not_applicable';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_provider_fee_cap_cents_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_provider_fee_cap_cents_check
      CHECK (provider_fee_cap_cents IS NULL OR provider_fee_cap_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_stripe_processing_fee_cents_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_stripe_processing_fee_cents_check
      CHECK (stripe_processing_fee_cents IS NULL OR stripe_processing_fee_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_provider_processing_fee_cents_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_provider_processing_fee_cents_check
      CHECK (provider_processing_fee_cents >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_processing_fee_status_check') THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_processing_fee_status_check
      CHECK (processing_fee_status IN ('not_applicable', 'pending', 'final', 'unavailable'));
  END IF;
END $$;

-- Do not retrofit finalized bookings. Their existing records remain the source
-- of truth. New checkout code writes the cap and fee-allocation snapshots.
