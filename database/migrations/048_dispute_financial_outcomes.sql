ALTER TABLE booking_disputes
  ADD COLUMN IF NOT EXISTS resolution_outcome text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by text REFERENCES "user"(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_disputes_resolution_outcome_check'
  ) THEN
    ALTER TABLE booking_disputes
      ADD CONSTRAINT booking_disputes_resolution_outcome_check
      CHECK (resolution_outcome IS NULL OR resolution_outcome IN ('provider', 'customer'));
  END IF;
END $$;

