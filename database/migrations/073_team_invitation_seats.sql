ALTER TABLE provider_team_members
  DROP CONSTRAINT IF EXISTS provider_team_members_status_check;

ALTER TABLE provider_team_members
  ADD CONSTRAINT provider_team_members_status_check
  CHECK (status IN ('pending', 'active', 'inactive'));

-- Existing entries that have never been claimed by an account are invitations.
-- They reserve a seat, but cannot access the provider dashboard until claimed.
UPDATE provider_team_members
SET status = 'pending'
WHERE status = 'active' AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS provider_team_members_reserved_seats_idx
  ON provider_team_members(provider_id, lower(email))
  WHERE status IN ('pending', 'active');
