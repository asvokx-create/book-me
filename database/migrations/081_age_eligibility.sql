ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS user_age_verified_at_idx
ON "user" (age_verified_at)
WHERE age_verified_at IS NOT NULL;

-- Existing sessions are intentionally ended once. Existing accounts are not deleted;
-- they complete the same age confirmation at their next sign-in.
DELETE FROM "session" AS active_session
USING "user" AS account
WHERE active_session."userId" = account.id
  AND account.age_verified_at IS NULL;
