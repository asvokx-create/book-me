-- Optional post-completion customer tips. Tips remain separate from booking
-- service value, marketplace fees, Partner compensation, and service refunds.
CREATE TABLE IF NOT EXISTS booking_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'usd' CHECK (currency = lower(currency) AND char_length(currency) = 3),
  amount_cents integer NOT NULL CHECK (amount_cents >= 50),
  tip_type text NOT NULL CHECK (tip_type IN ('percentage', 'custom')),
  percentage smallint CHECK (percentage IS NULL OR percentage IN (10, 15, 20)),
  stripe_mode text NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text UNIQUE,
  stripe_transfer_id text UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed')),
  transfer_status text NOT NULL DEFAULT 'not_ready'
    CHECK (transfer_status IN ('not_ready', 'pending', 'paid_out', 'partially_reversed', 'reversed', 'failed')),
  refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  stripe_refund_id text,
  stripe_dispute_id text,
  stripe_dispute_status text,
  failure_reason text,
  transfer_failure_reason text,
  risk_status text NOT NULL DEFAULT 'clear' CHECK (risk_status IN ('clear', 'review')),
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  transferred_at timestamptz,
  refunded_at timestamptz,
  CHECK ((tip_type = 'percentage' AND percentage IN (10, 15, 20)) OR (tip_type = 'custom' AND percentage IS NULL)),
  CHECK (refunded_amount_cents <= amount_cents)
);

CREATE INDEX IF NOT EXISTS booking_tips_provider_status_idx ON booking_tips(provider_id, payment_status, transferred_at DESC);
CREATE INDEX IF NOT EXISTS booking_tips_customer_idx ON booking_tips(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_tips_review_idx ON booking_tips(risk_status, payment_status, created_at DESC) WHERE risk_status = 'review';

DROP TRIGGER IF EXISTS booking_tips_set_updated_at ON booking_tips;
CREATE TRIGGER booking_tips_set_updated_at BEFORE UPDATE ON booking_tips FOR EACH ROW EXECUTE FUNCTION set_updated_at();
