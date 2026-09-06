CREATE TABLE IF NOT EXISTS provider_verification_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  overall_status text NOT NULL CHECK (overall_status IN ('passed', 'needs_changes')),
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_verification_checks_provider_created_idx
  ON provider_verification_checks(provider_id, created_at DESC);
