-- Provider-scoped client CRM and permissioned marketing campaigns.
-- Client identity remains derived from real marketplace activity; this migration
-- stores only provider-private CRM metadata and immutable campaign snapshots.

ALTER TABLE provider_team_members
  ADD COLUMN IF NOT EXISTS can_view_clients boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_clients boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_campaigns boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_send_campaigns boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS provider_client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  color text NOT NULL DEFAULT 'sage' CHECK (color IN ('sage','yellow','blue','plum','orange','gray')),
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_client_tags_name_key ON provider_client_tags(provider_id, lower(name));

CREATE TABLE IF NOT EXISTS provider_client_tag_assignments (
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES provider_client_tags(id) ON DELETE CASCADE,
  assigned_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS provider_client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  author_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_client_notes_client_idx ON provider_client_notes(provider_id,customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS provider_marketing_preferences (
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
  source text NOT NULL DEFAULT 'existing_customer_relationship',
  updated_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  PRIMARY KEY (provider_id, customer_id)
);

CREATE TABLE IF NOT EXISTS provider_marketing_access (
  provider_id uuid PRIMARY KEY REFERENCES provider_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled','review','disabled')),
  reason text NOT NULL DEFAULT '',
  changed_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  template_key text NOT NULL DEFAULT 'general',
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 150),
  preview_text text NOT NULL DEFAULT '' CHECK (char_length(preview_text) <= 180),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 1 AND 150),
  preview_text text NOT NULL DEFAULT '' CHECK (char_length(preview_text) <= 180),
  template_key text NOT NULL DEFAULT 'general',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','paused','cancelled','failed')),
  scheduled_at timestamptz,
  sending_started_at timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_campaigns_provider_idx ON marketing_campaigns(provider_id,created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_campaigns_due_idx ON marketing_campaigns(status,scheduled_at) WHERE status='scheduled';

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  personalization jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','delivered','soft_bounced','hard_bounced','complained','unsubscribed','suppressed','failed','cancelled')),
  provider_message_id text,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  last_error text NOT NULL DEFAULT '',
  sent_at timestamptz,
  delivered_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, customer_id),
  UNIQUE (campaign_id, email)
);
CREATE INDEX IF NOT EXISTS campaign_recipients_queue_idx ON marketing_campaign_recipients(status,next_attempt_at,created_at);
CREATE INDEX IF NOT EXISTS campaign_recipients_client_idx ON marketing_campaign_recipients(provider_id,customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text REFERENCES "user"(id) ON DELETE CASCADE,
  email_hash text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('unsubscribed','hard_bounce','complaint','invalid','manual')),
  source text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_suppressions_scope_key ON marketing_suppressions(COALESCE(provider_id,'00000000-0000-0000-0000-000000000000'::uuid),email_hash,reason);

CREATE TABLE IF NOT EXISTS marketing_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('attempted','sent','delivered','soft_bounce','hard_bounce','complaint','click','unsubscribe','booking')),
  provider_event_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_email_events_provider_key ON marketing_email_events(provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS marketing_email_events_recipient_idx ON marketing_email_events(recipient_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES marketing_campaign_recipients(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  booking_id uuid UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  attributed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_attributions_click_key ON marketing_attributions(recipient_id,customer_id) WHERE booking_id IS NULL;

DROP TRIGGER IF EXISTS provider_client_notes_set_updated_at ON provider_client_notes;
CREATE TRIGGER provider_client_notes_set_updated_at BEFORE UPDATE ON provider_client_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS provider_email_templates_set_updated_at ON provider_email_templates;
CREATE TRIGGER provider_email_templates_set_updated_at BEFORE UPDATE ON provider_email_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS marketing_campaigns_set_updated_at ON marketing_campaigns;
CREATE TRIGGER marketing_campaigns_set_updated_at BEFORE UPDATE ON marketing_campaigns FOR EACH ROW EXECUTE FUNCTION set_updated_at();
