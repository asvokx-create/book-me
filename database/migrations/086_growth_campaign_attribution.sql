-- Privacy-minimized first-party campaign attribution. It stores campaign
-- parameters and an opaque token, never a full browsing profile.
CREATE TABLE IF NOT EXISTS growth_campaign_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_token uuid NOT NULL UNIQUE,
  landing_path text NOT NULL CHECK (char_length(landing_path) <= 500),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  attributed_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  attributed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS growth_campaign_attributions_created_idx ON growth_campaign_attributions(created_at DESC);
CREATE INDEX IF NOT EXISTS growth_campaign_attributions_user_idx ON growth_campaign_attributions(attributed_user_id, created_at DESC) WHERE attributed_user_id IS NOT NULL;
