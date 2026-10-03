import "server-only";
import { database } from "./database";

export type AffiliateAccountState = {
  id: string;
  status: string;
  affiliate_code: string | null;
  compensation_type: "standard" | "custom";
  custom_partnership_requested: boolean;
};

export async function findAffiliateForUser(userId: string) {
  const result = await database.query<AffiliateAccountState>(`SELECT id::text,status,affiliate_code,
    compensation_type,custom_partnership_requested
    FROM affiliate_profiles WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function safelyLinkHistoricalAffiliate(input: { userId: string; email: string; emailVerified: boolean }) {
  const linked = await findAffiliateForUser(input.userId);
  if (linked || !input.emailVerified) return linked;

  const candidates = await database.query<AffiliateAccountState>(`SELECT id::text,status,affiliate_code,
    compensation_type,custom_partnership_requested
    FROM affiliate_profiles WHERE user_id IS NULL AND lower(email)=lower($1)
    ORDER BY created_at DESC LIMIT 2`, [input.email]);
  if (candidates.rows.length !== 1) return null;

  const candidate = candidates.rows[0];
  const result = await database.query<AffiliateAccountState>(`UPDATE affiliate_profiles affiliate
    SET user_id=$1,account_link_status='linked',account_linked_at=now(),
      account_link_review_note='Safely linked after the applicant signed in with one exact verified-email match.'
    WHERE affiliate.id=$2::uuid AND affiliate.user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM affiliate_profiles existing WHERE existing.user_id=$1)
    RETURNING affiliate.id::text,affiliate.status,affiliate.affiliate_code,
      affiliate.compensation_type,affiliate.custom_partnership_requested`, [input.userId, candidate.id]);
  if (!result.rows[0]) return findAffiliateForUser(input.userId);
  await database.query(`INSERT INTO affiliate_audit_log (actor_user_id,action,target_type,target_id,details)
    VALUES ($1,'affiliate_account_auto_linked','affiliate',$2,$3::jsonb)`, [input.userId, candidate.id,
    JSON.stringify({ match: "exact_verified_email" })]);
  return result.rows[0];
}
