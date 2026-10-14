-- Existing accounts can sign in and complete age confirmation from Account settings.
-- Add one durable in-product notification for every account that still needs it.
INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
SELECT id,
       'age_confirmation',
       'Confirm your age',
       'Please confirm that you are at least 18 in Account settings before using restricted marketplace features.',
       '/account/settings#age-confirmation',
       'age-confirmation-' || id
FROM "user"
WHERE age_verified_at IS NULL
ON CONFLICT (dedupe_key) DO NOTHING;
