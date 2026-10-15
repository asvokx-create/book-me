-- BubsBookings-owned provider outreach. This is deliberately separate from
-- provider-to-customer marketing campaigns and contains no delivery queue.

CREATE TABLE IF NOT EXISTS provider_outreach_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL CHECK (char_length(btrim(business_name)) BETWEEN 1 AND 160),
  website text,
  public_email text,
  public_phone text,
  city text NOT NULL CHECK (char_length(btrim(city)) BETWEEN 1 AND 100),
  state text NOT NULL CHECK (char_length(btrim(state)) = 2),
  service_category text NOT NULL CHECK (char_length(btrim(service_category)) BETWEEN 1 AND 100),
  contact_source text NOT NULL DEFAULT '' CHECK (char_length(contact_source) <= 300),
  research_notes text NOT NULL DEFAULT '' CHECK (char_length(research_notes) <= 4000),
  status text NOT NULL DEFAULT 'researching' CHECK (status IN ('researching','contact_ready','contacted','replied','interested','registered','not_interested','suppressed')),
  last_contacted_at timestamptz,
  replied_at timestamptz,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_outreach_prospects_identity_key
  ON provider_outreach_prospects (lower(btrim(business_name)), lower(btrim(city)), lower(btrim(state)));
CREATE INDEX IF NOT EXISTS provider_outreach_prospects_status_idx
  ON provider_outreach_prospects(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS provider_outreach_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (reason IN ('opt_out','complaint','hard_bounce','invalid','manual')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES provider_outreach_prospects(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 8000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  approval_note text NOT NULL DEFAULT '' CHECK (char_length(approval_note) <= 1000),
  approved_by text REFERENCES "user"(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_outreach_drafts_prospect_idx
  ON provider_outreach_drafts(prospect_id, created_at DESC);

DROP TRIGGER IF EXISTS provider_outreach_prospects_set_updated_at ON provider_outreach_prospects;
CREATE TRIGGER provider_outreach_prospects_set_updated_at BEFORE UPDATE ON provider_outreach_prospects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS provider_outreach_drafts_set_updated_at ON provider_outreach_drafts;
CREATE TRIGGER provider_outreach_drafts_set_updated_at BEFORE UPDATE ON provider_outreach_drafts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
