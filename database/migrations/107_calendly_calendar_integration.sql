CREATE TABLE IF NOT EXISTS provider_calendly_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL UNIQUE REFERENCES provider_profiles(id) ON DELETE CASCADE,
  calendly_user_uri text NOT NULL,
  calendly_organization_uri text NOT NULL,
  account_name text NOT NULL DEFAULT '',
  account_email text NOT NULL DEFAULT '',
  account_timezone text NOT NULL DEFAULT 'UTC',
  scheduling_url text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  granted_scope text NOT NULL DEFAULT '',
  webhook_subscription_uri text,
  webhook_status text NOT NULL DEFAULT 'not_configured'
    CHECK (webhook_status IN ('not_configured', 'active', 'unsupported', 'failed')),
  block_conflicting_bookings boolean NOT NULL DEFAULT false,
  last_sync_started_at timestamptz,
  last_sync_succeeded_at timestamptz,
  last_sync_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE INDEX IF NOT EXISTS provider_calendly_connections_sync_idx
  ON provider_calendly_connections(last_sync_succeeded_at, webhook_status)
  WHERE disconnected_at IS NULL;

CREATE TABLE IF NOT EXISTS provider_calendly_oauth_states (
  state_hash text PRIMARY KEY,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  code_verifier_encrypted text NOT NULL,
  return_path text NOT NULL DEFAULT '/provider/dashboard/calendar',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_calendly_oauth_states_expiry_idx
  ON provider_calendly_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS provider_calendly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES provider_calendly_connections(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  external_event_uri text NOT NULL,
  external_invitee_uri text,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'canceled')),
  location text NOT NULL DEFAULT 'Calendly appointment',
  event_timezone text NOT NULL DEFAULT 'UTC',
  rescheduled boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_event_uri)
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_calendly_events_invitee_idx
  ON provider_calendly_events(connection_id, external_invitee_uri)
  WHERE external_invitee_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS provider_calendly_events_calendar_idx
  ON provider_calendly_events(provider_id, starts_at, ends_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS calendly_webhook_deliveries (
  payload_hash text PRIMARY KEY,
  event_type text NOT NULL,
  provider_id uuid REFERENCES provider_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS calendly_webhook_deliveries_status_idx
  ON calendly_webhook_deliveries(status, received_at DESC);

COMMENT ON TABLE provider_calendly_events IS
  'External calendar appointments only. Rows never create bookings, charges, commissions, payouts, or marketing consent.';
