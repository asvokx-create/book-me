import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { runAutomatedProviderVerification } from "@/lib/provider-verification";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{ verification_type: string; status: string; admin_note: string }>(`SELECT vr.verification_type, vr.status, vr.admin_note
    FROM provider_verification_requests vr JOIN provider_profiles p ON p.id = vr.provider_id
    WHERE p.user_id = $1 ORDER BY vr.created_at DESC`, [session.user.id]);
  const latest = new Map<string, { status: string; adminNote: string }>();
  for (const row of result.rows) if (!latest.has(row.verification_type)) latest.set(row.verification_type, { status: row.status, adminNote: row.admin_note });
  return NextResponse.json({ requests: Object.fromEntries(latest) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "verification-request", limit: 6 })) return NextResponse.json({ error: "Too many verification requests. Please wait and try again." }, { status: 429 });
  const provider = await database.query<{ id: string }>("SELECT id::text FROM provider_profiles WHERE user_id = $1", [session.user.id]);
  if (!provider.rows[0]) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const result = await runAutomatedProviderVerification(provider.rows[0].id);
  return NextResponse.json({ ok: true, result });
}
