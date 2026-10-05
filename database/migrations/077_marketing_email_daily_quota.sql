-- Shared, UTC-day marketing allowance for the Resend free tier. Each accepted
-- marketing delivery (including test messages) reserves one idempotent slot.
CREATE TABLE IF NOT EXISTS marketing_email_daily_quota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quota_day date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','sent')),
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS marketing_email_daily_quota_day_idx
  ON marketing_email_daily_quota(quota_day, created_at);
