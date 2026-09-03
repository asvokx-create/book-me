CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  surface text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('medium', 'high', 'critical')),
  action text NOT NULL DEFAULT 'blocked' CHECK (action IN ('blocked', 'flagged')),
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_events_user_id_idx
  ON moderation_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_events_severity_idx
  ON moderation_events(severity, created_at DESC);
