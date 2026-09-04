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
  }>(role === "provider" ?
    `SELECT b.id::text, s.title, u.name AS person, b.starts_at, b.ends_at, b.service_address AS location, b.status
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN "user" u ON u.id = b.customer_id
     JOIN provider_profiles p ON p.id = b.provider_id
     WHERE p.user_id = $1 AND b.provider_deleted_at IS NULL AND b.status <> 'cancelled'
       AND b.starts_at >= now() - interval '6 months' AND b.starts_at < now() + interval '18 months'
     ORDER BY b.starts_at` :
    `SELECT b.id::text, s.title, p.business_name AS person, b.starts_at, b.ends_at, b.service_address AS location, b.status
     FROM bookings b JOIN services s ON s.id = b.service_id JOIN provider_profiles p ON p.id = b.provider_id
     WHERE b.customer_id = $1 AND b.status <> 'cancelled'
       AND b.starts_at >= now() - interval '6 months' AND b.starts_at < now() + interval '18 months'
     ORDER BY b.starts_at`, [session.user.id]);
  return NextResponse.json({ events: result.rows.map((row) => ({ id: row.id, title: row.title, person: row.person,
    startsAt: row.starts_at, endsAt: row.ends_at, location: row.location, status: row.status })) });
}
