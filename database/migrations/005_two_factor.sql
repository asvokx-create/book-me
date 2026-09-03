ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "twoFactor" (
  id text PRIMARY KEY,
  secret text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT true,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil" timestamptz
);

CREATE INDEX IF NOT EXISTS "twoFactor_secret_idx"
ON "twoFactor"(secret);

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx"
ON "twoFactor"("userId");
