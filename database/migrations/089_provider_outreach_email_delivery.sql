-- Keep provider-acquisition sends separate from provider-to-customer campaigns.
-- One approved draft can produce at most one delivery record, which prevents a
-- retry or repeated click from sending duplicate commercial email.
CREATE TABLE IF NOT EXISTS provider_outreach_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES provider_outreach_prospects(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL REFERENCES provider_outreach_drafts(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  sender_email text NOT NULL,
  provider_message_id text,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','unsubscribed')),
  error_message text NOT NULL DEFAULT '' CHECK (char_length(error_message) <= 1000),
  sent_by text REFERENCES "user"(id) ON DELETE SET NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id)
);

CREATE INDEX IF NOT EXISTS provider_outreach_deliveries_prospect_idx
  ON provider_outreach_deliveries (prospect_id, created_at DESC);

DROP TRIGGER IF EXISTS provider_outreach_deliveries_set_updated_at ON provider_outreach_deliveries;
CREATE TRIGGER provider_outreach_deliveries_set_updated_at
  BEFORE UPDATE ON provider_outreach_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
