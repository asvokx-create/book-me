CREATE TABLE IF NOT EXISTS complimentary_pro_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  granted_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reason text,
  revoked_at timestamptz,
  revoked_by text REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complimentary_pro_grants_expiration_check
    CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT complimentary_pro_grants_reason_length_check
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE INDEX IF NOT EXISTS complimentary_pro_grants_provider_created_idx
  ON complimentary_pro_grants(provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS complimentary_pro_grants_expiration_idx
  ON complimentary_pro_grants(expires_at)
  WHERE revoked_at IS NULL AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS complimentary_pro_grant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES complimentary_pro_grants(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('granted', 'extended', 'revoked', 'expired')),
  reason text,
  previous_expires_at timestamptz,
  new_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complimentary_pro_grant_events_reason_length_check
    CHECK (reason IS NULL OR char_length(reason) <= 500)
);

CREATE INDEX IF NOT EXISTS complimentary_pro_grant_events_provider_created_idx
  ON complimentary_pro_grant_events(provider_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS complimentary_pro_grant_events_expired_once_idx
  ON complimentary_pro_grant_events(grant_id, action)
  WHERE action = 'expired';
