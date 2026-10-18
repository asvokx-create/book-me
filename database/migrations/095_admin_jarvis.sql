CREATE TABLE IF NOT EXISTS jarvis_daily_usage (
  usage_date date PRIMARY KEY,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  reserved_tokens integer NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jarvis_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  actor_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  question_hash text NOT NULL,
  question_length integer NOT NULL CHECK (question_length >= 0),
  model text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('completed', 'rejected', 'failed')),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jarvis_audit_log_actor_created_idx
  ON jarvis_audit_log(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS jarvis_audit_log_status_created_idx
  ON jarvis_audit_log(status, created_at DESC);
