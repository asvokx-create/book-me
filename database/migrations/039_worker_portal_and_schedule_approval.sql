ALTER TABLE provider_team_members
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES "user"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS provider_team_members_user_idx
  ON provider_team_members(user_id, status);

UPDATE provider_team_members member
SET user_id = account.id
FROM "user" account
WHERE member.user_id IS NULL
  AND account."emailVerified" = true
  AND lower(account.email) = lower(member.email);

CREATE TABLE IF NOT EXISTS team_schedule_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES provider_team_members(id) ON DELETE CASCADE,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by text REFERENCES "user"(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_schedule_requests_pending_member_unique
  ON team_schedule_requests(team_member_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_schedule_requests_provider_idx
  ON team_schedule_requests(provider_id, status, created_at DESC);
