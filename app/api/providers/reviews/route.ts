import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{
    id: string; booking_id: string; customer_name: string; service_title: string;
    rating: number; body: string; created_at: Date;
  }>(
    `SELECT r.id::text, r.booking_id::text, customer.name AS customer_name,
            s.title AS service_title, r.rating, r.body, r.created_at
     FROM reviews r
     JOIN provider_profiles p ON p.id = r.provider_id
     JOIN "user" customer ON customer.id = r.customer_id
     JOIN services s ON s.id = r.service_id
     WHERE p.user_id = $1 AND r.is_hidden = false
     ORDER BY r.created_at DESC`,
    [session.user.id],
  );
  return NextResponse.json({ reviews: result.rows.map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    customerName: row.customer_name,
    serviceTitle: row.service_title,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
  })) });
}
