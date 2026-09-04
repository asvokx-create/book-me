CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'WA',
  search_radius_miles integer NOT NULL DEFAULT 10 CHECK (search_radius_miles IN (5, 10, 25, 50)),
  booking_notifications boolean NOT NULL DEFAULT true,
  message_notifications boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON user_settings;
CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
