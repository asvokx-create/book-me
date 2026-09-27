ALTER TABLE user_settings
  ALTER COLUMN theme SET DEFAULT 'light';

-- System was the former automatic default. Move existing accounts to the new
-- Light default; anyone can still explicitly choose Dark or System afterward.
UPDATE user_settings
SET theme = 'light', updated_at = NOW()
WHERE theme = 'system';
