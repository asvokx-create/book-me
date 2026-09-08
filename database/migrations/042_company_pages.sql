CREATE TABLE IF NOT EXISTS provider_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  bio text NOT NULL DEFAULT '',
  city text NOT NULL,
  state text NOT NULL,
  service_radius_miles integer NOT NULL DEFAULT 25 CHECK (service_radius_miles BETWEEN 1 AND 250),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_companies_provider_name_key
  ON provider_companies(provider_id, lower(name));

CREATE INDEX IF NOT EXISTS provider_companies_provider_idx
  ON provider_companies(provider_id, is_active, created_at);

DROP TRIGGER IF EXISTS provider_companies_set_updated_at ON provider_companies;
CREATE TRIGGER provider_companies_set_updated_at
BEFORE UPDATE ON provider_companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

WITH company_names AS (
  SELECT provider_id, business_name AS name FROM services
  UNION
  SELECT provider_id, company_name AS name FROM provider_team_members
  UNION
  SELECT id AS provider_id, business_name AS name FROM provider_profiles
)
INSERT INTO provider_companies (provider_id, name, slug, bio, city, state, service_radius_miles)
SELECT names.provider_id,
       names.name,
       COALESCE(NULLIF(trim(both '-' FROM regexp_replace(lower(names.name), '[^a-z0-9]+', '-', 'g')), ''), 'company')
         || '-' || substr(md5(names.provider_id::text || lower(names.name)), 1, 8),
       profile.bio,
       profile.city,
       profile.state,
       profile.service_radius_miles
FROM company_names names
JOIN provider_profiles profile ON profile.id = names.provider_id
WHERE btrim(names.name) <> ''
ON CONFLICT (provider_id, (lower(name))) DO NOTHING;

ALTER TABLE services ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES provider_companies(id) ON DELETE RESTRICT;
ALTER TABLE provider_team_members ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES provider_companies(id) ON DELETE CASCADE;

UPDATE services service
SET company_id = company.id
FROM provider_companies company
WHERE company.provider_id = service.provider_id
  AND lower(company.name) = lower(service.business_name)
  AND service.company_id IS NULL;

UPDATE provider_team_members member
SET company_id = company.id
FROM provider_companies company
WHERE company.provider_id = member.provider_id
  AND lower(company.name) = lower(member.company_name)
  AND member.company_id IS NULL;

ALTER TABLE services ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE provider_team_members ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS services_company_idx ON services(company_id, is_active, created_at);
CREATE INDEX IF NOT EXISTS provider_team_members_company_id_idx ON provider_team_members(company_id, status, created_at);
