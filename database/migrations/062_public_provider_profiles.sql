ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS public_profile_slug text,
  ADD COLUMN IF NOT EXISTS public_profile_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS years_experience smallint,
  ADD COLUMN IF NOT EXISTS experience_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS provider_highlights text[] NOT NULL DEFAULT ARRAY[]::text[];

WITH bases AS (
  SELECT id,
         COALESCE(NULLIF(trim(both '-' FROM regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g')), ''), 'provider') AS base_slug,
         row_number() OVER (
           PARTITION BY COALESCE(NULLIF(trim(both '-' FROM regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g')), ''), 'provider')
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM provider_profiles
  WHERE public_profile_slug IS NULL
)
UPDATE provider_profiles profile
SET public_profile_slug = CASE WHEN bases.duplicate_number = 1
  THEN bases.base_slug
  ELSE bases.base_slug || '-' || bases.duplicate_number::text
END
FROM bases
WHERE profile.id = bases.id;

ALTER TABLE provider_profiles ALTER COLUMN public_profile_slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS provider_profiles_public_profile_slug_unique
  ON provider_profiles (lower(public_profile_slug));
ALTER TABLE provider_profiles DROP CONSTRAINT IF EXISTS provider_profiles_years_experience_check;
ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_years_experience_check
  CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80);

CREATE TABLE IF NOT EXISTS provider_portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  object_key text NOT NULL,
  public_url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  sort_order smallint NOT NULL DEFAULT 0,
  moderation_status text NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('active', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_portfolio_items_provider_order_idx
  ON provider_portfolio_items (provider_id, sort_order, created_at);
