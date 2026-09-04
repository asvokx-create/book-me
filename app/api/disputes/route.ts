import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAndRecordContent } from "@/lib/content-safety";
import { database } from "@/lib/database";

const categories = new Set(["service_quality", "no_show", "damage", "billing", "other"]);

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [bookings, disputes] = await Promise.all([
    database.query(
      `SELECT b.id::text, b.status, b.starts_at, s.title AS service_title,
              CASE WHEN b.customer_id = $1 THEN p.business_name ELSE customer.name END AS other_party
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN "user" customer ON customer.id = b.customer_id
       WHERE (b.customer_id = $1 OR p.user_id = $1)
         AND b.status IN ('confirmed', 'completed', 'cancelled')
       ORDER BY b.starts_at DESC
       LIMIT 50`,
      [session.user.id],
    ),
    database.query(
      `SELECT d.id::text, d.booking_id::text, d.category, d.details, d.requested_resolution,
              d.status, d.admin_note, d.created_at, s.title AS service_title,
              against_user.name AS against_name
       FROM booking_disputes d
       JOIN bookings b ON b.id = d.booking_id
       JOIN services s ON s.id = b.service_id
       JOIN "user" against_user ON against_user.id = d.against_user_id
       WHERE d.opened_by = $1
       ORDER BY d.created_at DESC`,
      [session.user.id],
    ),
  ]);
  return NextResponse.json({ bookings: bookings.rows, disputes: disputes.rows });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const category = typeof body.category === "string" ? body.category : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const requestedResolution = typeof body.requestedResolution === "string" ? body.requestedResolution.trim() : "";
  if (!bookingId || !categories.has(category) || details.length < 20 || details.length > 2000 || requestedResolution.length < 5 || requestedResolution.length > 500) {
    return NextResponse.json({ error: "Choose a booking, explain the problem, and tell us what resolution you want." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "booking_dispute", fields: [details, requestedResolution] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });

  try {
    const result = await database.query<{ id: string }>(
      `INSERT INTO booking_disputes (booking_id, opened_by, against_user_id, category, details, requested_resolution)
       SELECT b.id, $2, CASE WHEN b.customer_id = $2 THEN p.user_id ELSE b.customer_id END, $3, $4, $5
       FROM bookings b
       JOIN provider_profiles p ON p.id = b.provider_id
       WHERE b.id::text = $1
         AND (b.customer_id = $2 OR p.user_id = $2)
         AND b.status IN ('confirmed', 'completed', 'cancelled')
       RETURNING id::text`,
      [bookingId, session.user.id, category, details, requestedResolution],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "That booking is not eligible for a dispute." }, { status: 404 });
    return NextResponse.json({ ok: true, disputeId: result.rows[0].id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "You already have an open dispute for this booking." }, { status: 409 });
    }
    console.error("Dispute creation failed", error);
    return NextResponse.json({ error: "We could not open that dispute." }, { status: 500 });
  }
}
