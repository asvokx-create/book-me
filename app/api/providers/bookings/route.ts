import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await database.query<{
    id: string; customer: string; service: string; starts_at: Date; location: string;
    price_cents: number; status: "requested" | "confirmed" | "completed" | "cancelled"; assignee_name: string;
  }>(
    `SELECT b.id::text, u.name AS customer, s.title AS service, b.starts_at,
            b.service_address AS location, b.price_cents, b.status, COALESCE(member.name, 'Company owner') AS assignee_name
     FROM bookings b
     JOIN provider_profiles p ON p.id = b.provider_id
     JOIN services s ON s.id = b.service_id
     JOIN "user" u ON u.id = b.customer_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     WHERE p.user_id = $1 AND b.provider_deleted_at IS NULL
     ORDER BY CASE b.status WHEN 'requested' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
              b.starts_at ASC`,
    [session.user.id],
  );

  return NextResponse.json({ bookings: result.rows.map((row) => ({
    id: row.id,
    customer: row.customer,
    initials: row.customer.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""),
    service: row.service,
    startsAt: row.starts_at,
    location: row.location,
    price: row.price_cents / 100,
    status: row.status === "requested" ? "new" : row.status === "confirmed" ? "accepted" : row.status === "completed" ? "completed" : "cancelled",
    assigneeName: row.assignee_name,
  })) });
}
