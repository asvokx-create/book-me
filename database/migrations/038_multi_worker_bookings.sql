CREATE TABLE IF NOT EXISTS booking_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES provider_team_members(id) ON DELETE CASCADE,
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_owner = true AND team_member_id IS NULL) OR (is_owner = false AND team_member_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_assignees_owner_unique
  ON booking_assignees(booking_id)
  WHERE is_owner = true;

CREATE UNIQUE INDEX IF NOT EXISTS booking_assignees_member_unique
  ON booking_assignees(booking_id, team_member_id)
  WHERE team_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS booking_assignees_member_schedule_idx
  ON booking_assignees(team_member_id, booking_id);

INSERT INTO booking_assignees (booking_id, team_member_id, is_owner)
SELECT id, assigned_team_member_id, assigned_team_member_id IS NULL
FROM bookings
ON CONFLICT DO NOTHING;
