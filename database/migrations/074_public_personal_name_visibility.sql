ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS public_personal_name_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN user_settings.public_personal_name_visible IS
  'Account-owner preference controlling whether the private account name may appear on public provider surfaces.';
