CREATE TABLE IF NOT EXISTS provider_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES provider_companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  latitude double precision,
  longitude double precision,
  service_radius_miles integer NOT NULL DEFAULT 25 CHECK (service_radius_miles BETWEEN 1 AND 250),
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_locations_company_name_key
  ON provider_locations(company_id, lower(name));
CREATE INDEX IF NOT EXISTS provider_locations_company_idx
  ON provider_locations(company_id, is_active, created_at);

DROP TRIGGER IF EXISTS provider_locations_set_updated_at ON provider_locations;
CREATE TRIGGER provider_locations_set_updated_at
BEFORE UPDATE ON provider_locations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO provider_locations (company_id, name, city, state, latitude, longitude, service_radius_miles, is_primary)
SELECT company.id,
       company.city || ', ' || company.state,
       company.city,
       company.state,
       profile.latitude,
       profile.longitude,
       company.service_radius_miles,
       true
FROM provider_companies company
JOIN provider_profiles profile ON profile.id = company.provider_id
WHERE NOT EXISTS (SELECT 1 FROM provider_locations existing WHERE existing.company_id = company.id)
ON CONFLICT (company_id, (lower(name))) DO NOTHING;

INSERT INTO provider_locations (company_id, name, city, state, latitude, longitude, service_radius_miles, is_primary)
SELECT DISTINCT service.company_id,
       COALESCE(service.city, company.city) || ', ' || COALESCE(service.state, company.state),
       COALESCE(service.city, company.city),
       COALESCE(service.state, company.state),
       service.latitude,
       service.longitude,
       company.service_radius_miles,
       false
FROM services service
JOIN provider_companies company ON company.id = service.company_id
WHERE service.company_id IS NOT NULL
ON CONFLICT (company_id, (lower(name))) DO NOTHING;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES provider_locations(id) ON DELETE RESTRICT;

UPDATE services service
SET location_id = location.id
FROM provider_locations location
WHERE location.company_id = service.company_id
  AND lower(location.city) = lower(COALESCE(service.city, location.city))
  AND lower(location.state) = lower(COALESCE(service.state, location.state))
  AND service.location_id IS NULL;

UPDATE services service
SET location_id = location.id
FROM provider_locations location
WHERE location.company_id = service.company_id
  AND location.is_primary = true
  AND service.location_id IS NULL;

ALTER TABLE services ALTER COLUMN location_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS services_location_idx ON services(location_id, is_active, created_at);

CREATE TABLE IF NOT EXISTS provider_team_member_locations (
  team_member_id uuid NOT NULL REFERENCES provider_team_members(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES provider_locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_member_id, location_id)
);

INSERT INTO provider_team_member_locations (team_member_id, location_id)
SELECT member.id, location.id
FROM provider_team_members member
JOIN provider_locations location ON location.company_id = member.company_id AND location.is_active = true
WHERE NOT EXISTS (
  SELECT 1 FROM provider_team_member_locations existing WHERE existing.team_member_id = member.id
)
ON CONFLICT DO NOTHING;
