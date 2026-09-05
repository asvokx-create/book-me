import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { enforceRateLimit } from "@/lib/request-security";

const types = new Set(["phone", "identity", "business"]);

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
  const body = await request.json() as { type?: unknown; details?: unknown };
  const type = typeof body.type === "string" && types.has(body.type) ? body.type : "";
  const incoming = body.details && typeof body.details === "object" ? body.details as Record<string, unknown> : {};
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(incoming)) if (/^[a-z_]{2,30}$/.test(key) && typeof value === "string" && value.trim()) details[key] = value.trim().slice(0, 200);
  if (!type || Object.keys(details).length < 2) return NextResponse.json({ error: "Complete the verification form." }, { status: 400 });
  const safeText = Object.values(details);
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "verification_request", fields: safeText });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const provider = await database.query<{ id: string }>("SELECT id::text FROM provider_profiles WHERE user_id = $1", [session.user.id]);
  if (!provider.rows[0]) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  try {
    await database.query(`INSERT INTO provider_verification_requests (provider_id, verification_type, details)
      VALUES ($1::uuid, $2, $3::jsonb)`, [provider.rows[0].id, type, JSON.stringify(details)]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This verification is already awaiting admin review." }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true });
}
