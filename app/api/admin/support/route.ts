import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const [support, verifications] = await Promise.all([
    database.query(`SELECT sr.id::text, sr.subject, sr.message, sr.status, sr.admin_reply, sr.created_at,
      u.name AS user_name, u.email AS user_email FROM support_requests sr JOIN "user" u ON u.id = sr.user_id
      ORDER BY CASE sr.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, sr.created_at DESC LIMIT 100`),
    database.query(`SELECT vr.id::text, vr.verification_type, vr.details, vr.status, vr.admin_note, vr.created_at,
      p.business_name, u.name AS user_name, u.email AS user_email
      FROM provider_verification_requests vr JOIN provider_profiles p ON p.id = vr.provider_id JOIN "user" u ON u.id = p.user_id
      ORDER BY CASE vr.status WHEN 'pending' THEN 0 WHEN 'needs_changes' THEN 1 ELSE 2 END, vr.created_at DESC LIMIT 100`),
  ]);
  return NextResponse.json({ support: support.rows, verifications: verifications.rows });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json() as { type?: unknown; id?: unknown; status?: unknown; note?: unknown };
  const type = body.type === "support" || body.type === "verification" ? body.type : "";
  const id = typeof body.id === "string" ? body.id : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const allowed = type === "support" ? ["reviewing", "resolved"] : ["approved", "needs_changes"];
  const status = typeof body.status === "string" && allowed.includes(body.status) ? body.status : "";
  if (!type || !id || !status) return NextResponse.json({ error: "Choose a valid update." }, { status: 400 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (type === "support") {
      const result = await client.query<{ user_id: string }>("UPDATE support_requests SET status = $2, admin_reply = $3 WHERE id::text = $1 RETURNING user_id", [id, status, note]);
      if (!result.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Support request not found." }, { status: 404 }); }
      if (note) await client.query(`INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
        VALUES ($1, 'support_reply', 'Support replied', $2, '/account', $3) ON CONFLICT (dedupe_key) DO NOTHING`, [result.rows[0].user_id, note, `support-${id}-${Date.now()}`]);
    } else {
      const result = await client.query<{ provider_id: string; user_id: string; verification_type: string }>(`UPDATE provider_verification_requests vr SET status = $2, admin_note = $3
        FROM provider_profiles p WHERE vr.id::text = $1 AND p.id = vr.provider_id RETURNING vr.provider_id::text, p.user_id, vr.verification_type`, [id, status, note]);
      const row = result.rows[0];
      if (!row) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Verification request not found." }, { status: 404 }); }
      if (status === "approved") {
        const column = row.verification_type === "phone" ? "phone_verified" : row.verification_type === "identity" ? "identity_verified" : "business_verified";
        await client.query(`UPDATE provider_profiles SET ${column} = true WHERE id::text = $1`, [row.provider_id]);
      }
      await client.query(`INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
        VALUES ($1, 'verification_update', $2, $3, '/provider/dashboard/settings', $4) ON CONFLICT (dedupe_key) DO NOTHING`,
        [row.user_id, status === "approved" ? `${row.verification_type} verification approved` : `${row.verification_type} verification needs changes`, note || (status === "approved" ? "Your trust badge is now active." : "Open the Trust Center to review the request."), `verification-${id}-${status}`]);
    }
    await client.query(`INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5::jsonb)`, [session.user.id, `${type}_${status}`, type, id, JSON.stringify({ note })]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK"); console.error("Admin support update failed", error);
    return NextResponse.json({ error: "That update could not be saved." }, { status: 500 });
  } finally { client.release(); }
}
