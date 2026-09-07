import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function getProviderAccess() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await database.query<{ provider_id: string; member_id: string; role: string }>(
    `SELECT member.provider_id::text, member.id::text AS member_id, member.role
     FROM provider_team_members member
     JOIN provider_profiles provider ON provider.id = member.provider_id AND provider.is_active = true
     WHERE member.status = 'active'
       AND provider.user_id <> $1
       AND (member.user_id = $1 OR (member.user_id IS NULL AND lower(member.email) = lower($2)))
     ORDER BY (member.user_id = $1) DESC, member.created_at LIMIT 1`,
    [session.user.id, session.user.email],
  );
  const member = membership.rows[0];
  if (member) {
    await database.query("UPDATE provider_team_members SET user_id = $1 WHERE id::text = $2 AND user_id IS NULL", [session.user.id, member.member_id]);
    return { session, providerId: member.provider_id, isOwner: false as const, memberId: member.member_id, memberRole: member.role };
  }

  const owned = await database.query<{ id: string }>(
    "SELECT id::text FROM provider_profiles WHERE user_id = $1 AND is_active = true LIMIT 1",
    [session.user.id],
  );
  if (owned.rows[0]) return { session, providerId: owned.rows[0].id, isOwner: true as const, memberId: null, memberRole: "Owner" };
  return null;
}
