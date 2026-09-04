CREATE TABLE IF NOT EXISTS account_restrictions (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('suspended', 'banned')),
  reason text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_restrictions_status_idx
  ON account_restrictions(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS bookme_admins (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO bookme_admins (user_id)
SELECT id FROM "user" WHERE lower(email) = 'asvokx@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON admin_audit_log(target_type, target_id, created_at DESC);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'starter'
  CHECK (plan IN ('starter', 'pro', 'business'));

UPDATE provider_profiles p
SET plan = 'business', updated_at = now()
FROM "user" u
WHERE p.user_id = u.id AND lower(u.email) = 'asvokx@gmail.com';
