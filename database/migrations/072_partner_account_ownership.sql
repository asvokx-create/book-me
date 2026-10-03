ALTER TABLE affiliate_profiles
  ADD COLUMN IF NOT EXISTS account_link_status text NOT NULL DEFAULT 'setup_required'
    CHECK (account_link_status IN ('linked','setup_required','manual_review')),
  ADD COLUMN IF NOT EXISTS account_linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_link_review_note text NOT NULL DEFAULT '';

UPDATE affiliate_profiles
SET account_link_status = 'linked',
    account_linked_at = COALESCE(account_linked_at, updated_at, created_at)
WHERE user_id IS NOT NULL;

WITH verified_matches AS (
  SELECT affiliate.id AS affiliate_id, min(account.id) AS user_id, count(*)::int AS match_count
  FROM affiliate_profiles affiliate
  JOIN "user" account ON lower(account.email) = lower(affiliate.email) AND account."emailVerified" = true
  WHERE affiliate.user_id IS NULL
  GROUP BY affiliate.id
), safe_matches AS (
  SELECT match.affiliate_id, match.user_id
  FROM verified_matches match
  WHERE match.match_count = 1
    AND NOT EXISTS (SELECT 1 FROM affiliate_profiles existing WHERE existing.user_id = match.user_id)
)
UPDATE affiliate_profiles affiliate
SET user_id = safe.user_id,
    account_link_status = 'linked',
    account_linked_at = now(),
    account_link_review_note = 'Automatically linked by migration using one exact verified-email match.'
FROM safe_matches safe
WHERE affiliate.id = safe.affiliate_id AND affiliate.user_id IS NULL;

UPDATE affiliate_profiles affiliate
SET account_link_status = CASE
      WHEN EXISTS (
        SELECT 1 FROM "user" account
        WHERE lower(account.email) = lower(affiliate.email) AND account."emailVerified" = true
      ) THEN 'manual_review'
      ELSE 'setup_required'
    END,
    account_link_review_note = CASE
      WHEN EXISTS (
        SELECT 1 FROM "user" account
        WHERE lower(account.email) = lower(affiliate.email) AND account."emailVerified" = true
      ) THEN 'A verified email match exists but could not be linked safely. Administrator review is required.'
      ELSE 'The applicant must create and verify a BubsBookings account using the application email.'
    END
WHERE affiliate.user_id IS NULL;

CREATE INDEX IF NOT EXISTS affiliate_profiles_account_link_review_idx
  ON affiliate_profiles(account_link_status, applied_at DESC)
  WHERE account_link_status <> 'linked';

CREATE OR REPLACE VIEW affiliate_account_link_audit AS
SELECT affiliate.id AS affiliate_id,
  affiliate.display_name AS applicant_name,
  affiliate.email AS application_email,
  affiliate.status AS application_status,
  affiliate.user_id AS linked_user_id,
  affiliate.account_link_status,
  affiliate.account_link_review_note,
  count(account.id)::int AS matching_account_count,
  count(account.id) FILTER (WHERE account."emailVerified" = true)::int AS verified_matching_account_count,
  CASE
    WHEN affiliate.user_id IS NOT NULL THEN 'linked'
    WHEN count(account.id) FILTER (WHERE account."emailVerified" = true) = 1 THEN 'exact_verified_email'
    WHEN count(account.id) FILTER (WHERE account."emailVerified" = true) > 1 THEN 'ambiguous'
    WHEN count(account.id) > 0 THEN 'unverified_email_only'
    ELSE 'no_account'
  END AS possible_match_confidence
FROM affiliate_profiles affiliate
LEFT JOIN "user" account ON lower(account.email) = lower(affiliate.email)
GROUP BY affiliate.id;
