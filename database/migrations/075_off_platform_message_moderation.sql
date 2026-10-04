ALTER TABLE account_restrictions
  DROP CONSTRAINT IF EXISTS account_restrictions_status_check;

ALTER TABLE account_restrictions
  ADD CONSTRAINT account_restrictions_status_check
  CHECK (status IN ('under_review', 'suspended', 'banned'));

CREATE TABLE IF NOT EXISTS message_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  sender_id text REFERENCES "user"(id) ON DELETE SET NULL,
  recipient_id text REFERENCES "user"(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  message_content text NOT NULL,
  content_hash text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  detection_reason text NOT NULL,
  triggered_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  booking_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_taken text NOT NULL CHECK (action_taken IN ('logged', 'blocked', 'blocked_under_review')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'false_positive', 'warning_only', 'under_review', 'suspended', 'banned', 'resolved')),
  account_status_snapshot text NOT NULL DEFAULT 'active',
  dedupe_key text NOT NULL UNIQUE,
  admin_notes text NOT NULL DEFAULT '',
  reviewed_by text REFERENCES "user"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_moderation_events_message_id_key
  ON message_moderation_events(message_id);
CREATE INDEX IF NOT EXISTS message_moderation_events_queue_idx
  ON message_moderation_events(status, risk_level, created_at DESC);
CREATE INDEX IF NOT EXISTS message_moderation_events_sender_idx
  ON message_moderation_events(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_moderation_events_conversation_idx
  ON message_moderation_events(conversation_id, created_at DESC);

DROP TRIGGER IF EXISTS message_moderation_events_set_updated_at ON message_moderation_events;
CREATE TRIGGER message_moderation_events_set_updated_at
BEFORE UPDATE ON message_moderation_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
