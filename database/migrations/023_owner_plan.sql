ALTER TABLE provider_profiles
  DROP CONSTRAINT IF EXISTS provider_profiles_plan_check;

ALTER TABLE provider_profiles
  ADD CONSTRAINT provider_profiles_plan_check
  CHECK (plan IN ('starter', 'pro', 'business', 'owner'));

UPDATE provider_profiles p
SET plan = 'owner', updated_at = now()
FROM "user" u
WHERE p.user_id = u.id AND lower(u.email) = 'asvokx@gmail.com';
