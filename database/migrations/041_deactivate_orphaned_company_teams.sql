UPDATE provider_team_members member
SET status = 'inactive', updated_at = now()
WHERE member.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM services service
    WHERE service.provider_id = member.provider_id
      AND service.business_name = member.company_name
      AND service.is_active = true
  );
