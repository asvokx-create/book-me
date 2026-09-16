ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS provider_dashboard_widgets jsonb NOT NULL DEFAULT '[]'::jsonb;
