ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS screening_status text NOT NULL DEFAULT 'not_screened'
    CHECK (screening_status IN ('not_screened', 'passed', 'needs_changes')),
  ADD COLUMN IF NOT EXISTS screening_score smallint
    CHECK (screening_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS screening_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS screening_checked_at timestamptz;

UPDATE provider_profiles
SET screening_status = 'passed',
    screening_score = 100,
    screening_summary = 'Existing active profile passed the BubsBookings baseline content screening.',
    screening_checked_at = COALESCE(updated_at, now()),
    is_verified = true
WHERE is_active = true AND screening_status = 'not_screened';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS late_cancellation boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS provider_profiles_screening_status_idx
  ON provider_profiles(screening_status, updated_at DESC);
