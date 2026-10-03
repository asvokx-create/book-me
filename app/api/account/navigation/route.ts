import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ authenticated: false, isAdmin: false, isAffiliate: false });

  const [isAdmin, affiliate] = await Promise.all([
    hasAdminAccess(session.user.id, session.user.email),
    database.query(`SELECT 1 FROM affiliate_profiles
      WHERE (user_id=$1 OR (user_id IS NULL AND lower(email)=lower($2)))
        AND status IN ('approved','active','paused') LIMIT 1`, [session.user.id, session.user.email]),
  ]);

  return NextResponse.json({
    authenticated: true,
    isAdmin,
    isAffiliate: Boolean(affiliate.rowCount),
  });
}
