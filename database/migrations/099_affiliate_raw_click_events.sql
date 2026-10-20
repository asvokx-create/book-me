CREATE TABLE IF NOT EXISTS affiliate_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES affiliate_programs(id) ON DELETE RESTRICT,
  affiliate_code text NOT NULL,
  landing_path text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_click_events_affiliate_created_idx
  ON affiliate_click_events(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_click_events_program_created_idx
  ON affiliate_click_events(program_id, created_at DESC);

-- Preserve every existing first-touch record as the minimum historical raw-click total.
-- Older repeat clicks cannot be reconstructed because they were never stored.
INSERT INTO affiliate_click_events (
  id, affiliate_id, program_id, affiliate_code, landing_path,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at
)
SELECT id, affiliate_id, program_id, affiliate_code, landing_path,
  utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at
FROM affiliate_clicks
ON CONFLICT (id) DO NOTHING;
