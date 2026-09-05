ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS assigned_team_member_id uuid REFERENCES provider_team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_assigned_team_member_idx
  ON bookings(assigned_team_member_id, starts_at, ends_at)
  WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS team_member_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES provider_team_members(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  CHECK (end_time > start_time),
  UNIQUE (team_member_id, weekday)
);

CREATE INDEX IF NOT EXISTS team_member_availability_member_idx
  ON team_member_availability(team_member_id, weekday);

CREATE TABLE IF NOT EXISTS provider_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES provider_team_members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS provider_time_off_provider_idx
  ON provider_time_off(provider_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS provider_time_off_member_idx
  ON provider_time_off(team_member_id, starts_at, ends_at);
