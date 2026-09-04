CREATE TABLE IF NOT EXISTS provider_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'manager')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, email)
);

CREATE INDEX IF NOT EXISTS provider_team_members_provider_idx
  ON provider_team_members(provider_id, status, created_at);

DROP TRIGGER IF EXISTS provider_team_members_set_updated_at ON provider_team_members;
CREATE TRIGGER provider_team_members_set_updated_at
BEFORE UPDATE ON provider_team_members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
