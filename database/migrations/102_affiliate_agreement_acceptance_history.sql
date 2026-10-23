ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS partner_agreement_content_hash text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS terms_content_hash text,
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS privacy_content_hash text,
  ADD COLUMN IF NOT EXISTS agreement_reacceptance_required_at timestamptz,
  ADD COLUMN IF NOT EXISTS agreement_reacceptance_reason text;

CREATE TABLE IF NOT EXISTS legal_document_versions (
  document_key text NOT NULL,
  version text NOT NULL,
  public_path text NOT NULL,
  source_path text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  effective_at date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_key, version)
);

CREATE TABLE IF NOT EXISTS affiliate_agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  user_id text NOT NULL,
  document_key text NOT NULL CHECK (document_key IN ('partner_agreement','terms_of_service','privacy_policy')),
  document_version text NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  acceptance_event text NOT NULL CHECK (acceptance_event IN ('affiliate_application','affiliate_reacceptance')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (affiliate_id, document_key, document_version)
);

CREATE INDEX IF NOT EXISTS affiliate_agreement_acceptances_affiliate_time_idx
  ON affiliate_agreement_acceptances (affiliate_id, accepted_at DESC);

INSERT INTO legal_document_versions (document_key,version,public_path,source_path,content_hash,effective_at) VALUES
  ('partner_agreement','2026-10-22','/partner-agreement','app/partner-agreement/page.tsx','978d5acf7b38e979776543f0d36fa1e3f646a0b2443872732471c9c0cc076cf5','2026-10-22'),
  ('terms_of_service','2026-10-22','/terms','app/terms/page.tsx','d51452e04d17ea7b1d0213a045bdae0671f0eaaf655c26d571d842d933a2cdd3','2026-10-22'),
  ('privacy_policy','2026-10-22','/privacy','app/privacy/page.tsx','d6c27548f8ed192178a99fb47da1cfa32899a2589b9c37239269d3952648eb28','2026-10-22')
ON CONFLICT (document_key,version) DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_affiliate_acceptance_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Affiliate agreement acceptance records are append-only';
END;
$$;

DROP TRIGGER IF EXISTS affiliate_acceptances_immutable ON affiliate_agreement_acceptances;
CREATE TRIGGER affiliate_acceptances_immutable
BEFORE UPDATE OR DELETE ON affiliate_agreement_acceptances
FOR EACH ROW EXECUTE FUNCTION prevent_affiliate_acceptance_mutation();

-- Existing profiles are deliberately left unchanged. Historical acceptances are not inferred.
-- The application inserts the current version records for new applicants after deployment.
