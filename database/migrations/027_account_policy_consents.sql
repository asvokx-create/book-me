ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS terms_accepted_at text,
ADD COLUMN IF NOT EXISTS privacy_acknowledged_at text,
ADD COLUMN IF NOT EXISTS ai_safety_acknowledged_at text,
ADD COLUMN IF NOT EXISTS policy_version text;
