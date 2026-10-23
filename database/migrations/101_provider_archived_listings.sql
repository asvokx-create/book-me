ALTER TABLE services
  ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS services_provider_archived_idx
  ON services(provider_id, updated_at DESC)
  WHERE is_active=false
    AND age_verification_blocked=false
    AND provider_deleted_at IS NULL;
