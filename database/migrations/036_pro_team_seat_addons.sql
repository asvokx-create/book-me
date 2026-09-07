ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS extra_team_seats integer NOT NULL DEFAULT 0
    CHECK (extra_team_seats BETWEEN 0 AND 97),
  ADD COLUMN IF NOT EXISTS stripe_team_seat_item_id text;

CREATE UNIQUE INDEX IF NOT EXISTS provider_profiles_stripe_team_seat_item_key
  ON provider_profiles(stripe_team_seat_item_id)
  WHERE stripe_team_seat_item_id IS NOT NULL;

