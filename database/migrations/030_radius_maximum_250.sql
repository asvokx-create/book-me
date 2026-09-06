ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_search_radius_miles_check;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_search_radius_miles_check
  CHECK (search_radius_miles BETWEEN 1 AND 250);

ALTER TABLE provider_profiles
  DROP CONSTRAINT IF EXISTS provider_profiles_service_radius_miles_check;

ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_service_radius_miles_check
  CHECK (service_radius_miles BETWEEN 1 AND 250);
