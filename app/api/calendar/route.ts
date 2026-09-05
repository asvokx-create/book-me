import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const role = new URL(request.url).searchParams.get("role") === "provider" ? "provider" : "customer";
  const result = await database.query<{
    id: string; title: string; person: string; starts_at: Date; ends_at: Date; location: string; status: string;
    assigned_team_member_id: string | null; assignee_name: string;
  }>(role === "provider" ?
    `SELECT b.id::text, s.title, u.name AS person, b.starts_at, b.ends_at, b.service_address AS location, b.status,
            b.assigned_team_member_id::text, COALESCE(member.name, 'Company owner') AS assignee_name
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN "user" u ON u.id = b.customer_id
     JOIN provider_profiles p ON p.id = b.provider_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     WHERE p.user_id = $1 AND b.provider_deleted_at IS NULL AND b.status <> 'cancelled'
       AND b.starts_at >= now() - interval '6 months' AND b.starts_at < now() + interval '18 months'
     ORDER BY b.starts_at` :
    `SELECT b.id::text, s.title, p.business_name AS person, b.starts_at, b.ends_at, b.service_address AS location, b.status,
            b.assigned_team_member_id::text, COALESCE(member.name, 'Company owner') AS assignee_name
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN provider_profiles p ON p.id = b.provider_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     WHERE b.customer_id = $1 AND b.status <> 'cancelled'
       AND b.starts_at >= now() - interval '6 months' AND b.starts_at < now() + interval '18 months'
     ORDER BY b.starts_at`, [session.user.id]);
  const staff = role === "provider" ? (await database.query<{ id: string; name: string }>(
    `SELECT member.id::text, member.name FROM provider_team_members member JOIN provider_profiles p ON p.id = member.provider_id
     WHERE p.user_id = $1 AND member.status = 'active' ORDER BY member.name`, [session.user.id])).rows : [];
  const timeOff = role === "provider" ? (await database.query<{ id: string; member_id: string | null; assignee_name: string; starts_at: Date; ends_at: Date; reason: string }>(
    `SELECT blocked.id::text, blocked.team_member_id::text AS member_id, COALESCE(member.name, 'Company owner') AS assignee_name,
            blocked.starts_at, blocked.ends_at, blocked.reason
     FROM provider_time_off blocked JOIN provider_profiles p ON p.id = blocked.provider_id
     LEFT JOIN provider_team_members member ON member.id = blocked.team_member_id
     WHERE p.user_id = $1 AND blocked.ends_at >= now() - interval '6 months' AND blocked.starts_at < now() + interval '18 months'`, [session.user.id])).rows : [];
  return NextResponse.json({ staff, events: [...result.rows.map((row) => ({ id: row.id, kind: "booking", title: row.title, person: row.person,
    startsAt: row.starts_at, endsAt: row.ends_at, location: row.location, status: row.status,
    assignedTeamMemberId: row.assigned_team_member_id, assigneeName: row.assignee_name })), ...timeOff.map((block) => ({ id: block.id, kind: "time_off", title: block.reason,
      person: block.assignee_name, startsAt: block.starts_at, endsAt: block.ends_at, location: "Unavailable", status: "blocked",
      assignedTeamMemberId: block.member_id, assigneeName: block.assignee_name }))] });
}
