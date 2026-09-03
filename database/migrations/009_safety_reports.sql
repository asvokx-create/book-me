CREATE TABLE IF NOT EXISTS safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  reporter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reported_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('harassment', 'spam', 'unsafe', 'other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS safety_reports_open_conversation_reporter_key
  ON safety_reports(conversation_id, reporter_id)
  WHERE status IN ('open', 'reviewing');

CREATE INDEX IF NOT EXISTS safety_reports_status_created_idx
  ON safety_reports(status, created_at DESC);
