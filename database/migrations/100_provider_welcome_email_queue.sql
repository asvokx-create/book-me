CREATE TABLE IF NOT EXISTS provider_welcome_email_deliveries (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL UNIQUE REFERENCES provider_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  last_error text NOT NULL DEFAULT '',
  queued_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_welcome_email_retry_idx
  ON provider_welcome_email_deliveries(next_attempt_at, queued_at)
  WHERE status IN ('queued', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS provider_welcome_email_message_key
  ON provider_welcome_email_deliveries(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
