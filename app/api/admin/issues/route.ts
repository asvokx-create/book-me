import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";

const statuses = new Set(["reviewing", "resolved", "dismissed"]);

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const type = new URL(request.url).searchParams.get("type");
  if (type === "bugs") {
    const result = await database.query(
      `SELECT br.id::text, br.title, br.details, br.steps_to_reproduce, br.page_url,
              br.status, br.admin_note, br.created_at, u.name AS reporter_name, u.email AS reporter_email
       FROM bug_reports br JOIN "user" u ON u.id = br.reporter_id
       ORDER BY CASE br.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, br.created_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ issues: result.rows });
  }
  if (type === "disputes") {
    const result = await database.query(
      `SELECT d.id::text, d.category, d.details, d.requested_resolution, d.status,
              d.admin_note, d.created_at, s.title AS service_title, b.id::text AS booking_id,
              opener.name AS reporter_name, opener.email AS reporter_email,
              against_user.name AS against_name, against_user.email AS against_email
       FROM booking_disputes d
       JOIN bookings b ON b.id = d.booking_id
       JOIN services s ON s.id = b.service_id
       JOIN "user" opener ON opener.id = d.opened_by
       JOIN "user" against_user ON against_user.id = d.against_user_id
       ORDER BY CASE d.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, d.created_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ issues: result.rows });
  }
  return NextResponse.json({ error: "Choose bugs or disputes." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const body = (await request.json()) as Record<string, unknown>;
  const type = body.type === "bugs" || body.type === "disputes" ? body.type : "";
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  if (!type || !id || !statuses.has(status)) return NextResponse.json({ error: "Choose a valid case update." }, { status: 400 });
  const table = type === "bugs" ? "bug_reports" : "booking_disputes";
  const result = await database.query(`UPDATE ${table} SET status = $2, admin_note = $3, updated_at = now() WHERE id::text = $1`, [id, status, note]);
  if (!result.rowCount) return NextResponse.json({ error: "That case was not found." }, { status: 404 });
  await database.query(
    `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [session.user.id, `${type}_${status}`, type === "bugs" ? "bug_report" : "booking_dispute", id, JSON.stringify({ status, note })],
  );
  return NextResponse.json({ ok: true });
}
