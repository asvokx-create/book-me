ALTER TABLE provider_team_members
  DROP CONSTRAINT IF EXISTS provider_team_members_role_check;

ALTER TABLE provider_team_members
  ADD CONSTRAINT provider_team_members_role_check
  CHECK (char_length(btrim(role)) BETWEEN 2 AND 40);

