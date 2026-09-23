ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_state text,
  ADD COLUMN IF NOT EXISTS location_postal_code text,
  ADD COLUMN IF NOT EXISTS location_country text DEFAULT 'United States',
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

ALTER TABLE "user"
  DROP CONSTRAINT IF EXISTS user_location_source_check;

ALTER TABLE "user"
  ADD CONSTRAINT user_location_source_check
  CHECK (location_source IS NULL OR location_source IN ('USER_ENTERED', 'BROWSER_LOCATION_CONFIRMED', 'EXISTING_PROFILE', 'ADMIN_UPDATED'));

UPDATE "user" account
SET location_city = COALESCE(NULLIF(trim(settings.city), ''), NULLIF(trim(provider.city), '')),
    location_state = COALESCE(NULLIF(upper(trim(settings.state)), ''), NULLIF(upper(trim(provider.state)), '')),
    location_country = 'United States',
    location_source = 'EXISTING_PROFILE',
    location_updated_at = now()
FROM user_settings settings
LEFT JOIN provider_profiles provider ON provider.user_id = settings.user_id
WHERE settings.user_id = account.id
  AND account.location_city IS NULL
  AND COALESCE(NULLIF(trim(settings.city), ''), NULLIF(trim(provider.city), '')) IS NOT NULL;

UPDATE "user" account
SET location_city = trim(provider.city),
    location_state = upper(trim(provider.state)),
    location_country = 'United States',
    location_source = 'EXISTING_PROFILE',
    location_updated_at = now()
FROM provider_profiles provider
WHERE provider.user_id = account.id
  AND account.location_city IS NULL
  AND NULLIF(trim(provider.city), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_general_location_index
  ON "user" (location_state, location_city)
  WHERE location_city IS NOT NULL AND location_state IS NOT NULL;
