ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'auto';

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_theme_check;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_theme_check
  CHECK (theme IN ('light', 'dark', 'system'));

