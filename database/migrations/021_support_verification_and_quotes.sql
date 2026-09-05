CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved')),
  admin_reply text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_status_created_idx
  ON support_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  verification_type text NOT NULL CHECK (verification_type IN ('phone', 'identity', 'business')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'needs_changes')),
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS provider_verification_requests_pending_key
  ON provider_verification_requests(provider_id, verification_type)
  WHERE status = 'pending';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS quote_status text NOT NULL DEFAULT 'none'
    CHECK (quote_status IN ('none', 'pending', 'accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS quoted_price_cents integer CHECK (quoted_price_cents IS NULL OR quoted_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS quote_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_responded_at timestamptz;

DROP TRIGGER IF EXISTS support_requests_set_updated_at ON support_requests;
CREATE TRIGGER support_requests_set_updated_at
BEFORE UPDATE ON support_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS provider_verification_requests_set_updated_at ON provider_verification_requests;
CREATE TRIGGER provider_verification_requests_set_updated_at
BEFORE UPDATE ON provider_verification_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
