CREATE TABLE IF NOT EXISTS jarvis_phone_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jarvis_phone_access_codes_expiry_idx
  ON jarvis_phone_access_codes(expires_at DESC);

CREATE TABLE IF NOT EXISTS jarvis_phone_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twilio_call_sid text NOT NULL UNIQUE,
  session_token_hash text NOT NULL UNIQUE,
  caller_last_four text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_phone_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  outbound_alerts_enabled boolean NOT NULL DEFAULT false,
  minimum_severity text NOT NULL DEFAULT 'critical' CHECK (minimum_severity IN ('critical', 'high')),
  quiet_hours_start smallint NOT NULL DEFAULT 21 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end smallint NOT NULL DEFAULT 7 CHECK (quiet_hours_end BETWEEN 0 AND 23),
  time_zone text NOT NULL DEFAULT 'America/Los_Angeles',
  updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO jarvis_phone_settings(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS jarvis_incident_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  incident_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high')),
  title text NOT NULL,
  evidence text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'suppressed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  twilio_call_sid text UNIQUE,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jarvis_incident_alerts_due_idx
  ON jarvis_incident_alerts(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS jarvis_phone_daily_usage (
  usage_date date PRIMARY KEY,
  outbound_call_count integer NOT NULL DEFAULT 0 CHECK (outbound_call_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_voice_webhook_events (
  provider text NOT NULL CHECK (provider IN ('openai', 'twilio')),
  delivery_id text NOT NULL,
  event_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, delivery_id)
);
