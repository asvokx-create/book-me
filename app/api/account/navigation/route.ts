import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ authenticated: false, isAdmin: false });

  return NextResponse.json({
    authenticated: true,
    isAdmin: await hasAdminAccess(session.user.id, session.user.email),
  });
}
