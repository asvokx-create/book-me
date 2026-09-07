ALTER TABLE provider_team_members
  ADD COLUMN IF NOT EXISTS company_name text;

UPDATE provider_team_members member
SET company_name = provider.business_name
FROM provider_profiles provider
WHERE provider.id = member.provider_id
  AND (member.company_name IS NULL OR btrim(member.company_name) = '');

ALTER TABLE provider_team_members
  ALTER COLUMN company_name SET NOT NULL;

ALTER TABLE provider_team_members
  DROP CONSTRAINT IF EXISTS provider_team_members_provider_id_email_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'provider_team_members_provider_company_email_key'
  ) THEN
    ALTER TABLE provider_team_members
      ADD CONSTRAINT provider_team_members_provider_company_email_key
      UNIQUE (provider_id, company_name, email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS provider_team_members_company_idx
  ON provider_team_members(provider_id, company_name, status, created_at);
