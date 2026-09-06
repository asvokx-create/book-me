ALTER TABLE services
ADD COLUMN IF NOT EXISTS business_name text;

UPDATE services s
SET business_name = p.business_name
FROM provider_profiles p
WHERE s.provider_id = p.id
  AND (s.business_name IS NULL OR btrim(s.business_name) = '');

ALTER TABLE services
ALTER COLUMN business_name SET NOT NULL;
