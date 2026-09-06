ALTER TABLE user_settings
  ALTER COLUMN search_radius_miles SET DEFAULT 25,
  DROP CONSTRAINT IF EXISTS user_settings_search_radius_miles_check;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_search_radius_miles_check
  CHECK (search_radius_miles BETWEEN 1 AND 100);

ALTER TABLE provider_profiles
  ALTER COLUMN service_radius_miles SET DEFAULT 25,
  DROP CONSTRAINT IF EXISTS provider_profiles_service_radius_miles_check;

ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_service_radius_miles_check
  CHECK (service_radius_miles BETWEEN 1 AND 100);

CREATE TABLE IF NOT EXISTS schema_migration_markers (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schema_migration_markers
    WHERE name = '029_radius_defaults_backfill'
  ) THEN
    UPDATE user_settings
    SET search_radius_miles = 25
    WHERE search_radius_miles = 10;

    UPDATE provider_profiles
    SET service_radius_miles = 25
    WHERE service_radius_miles = 15;

    INSERT INTO schema_migration_markers (name)
    VALUES ('029_radius_defaults_backfill');
  END IF;
END $$;
