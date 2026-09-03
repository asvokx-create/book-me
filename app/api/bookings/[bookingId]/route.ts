import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET(_request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;

  const result = await database.query<{
    id: string; customer_id: string; customer_name: string; provider_id: string; provider_user_id: string;
    provider_name: string; service_id: string; service_slug: string; service_title: string; category: string;
    starts_at: Date; ends_at: Date; service_address: string; notes: string; price_cents: number; status: string;
    cancelled_by: string | null; cancellation_reason: string | null; completed_at: Date | null;
    conversation_id: string | null; review_id: string | null; rating: number | null; review_body: string | null;
  }>(
    `SELECT b.id::text, b.customer_id, customer.name AS customer_name,
            b.provider_id::text, p.user_id AS provider_user_id, p.business_name AS provider_name,
            b.service_id::text, s.slug AS service_slug, s.title AS service_title, s.category,
            b.starts_at, b.ends_at, b.service_address, b.notes, b.price_cents, b.status,
            b.cancelled_by, b.cancellation_reason, b.completed_at,
            c.id::text AS conversation_id, r.id::text AS review_id, r.rating, r.body AS review_body
     FROM bookings b
     JOIN "user" customer ON customer.id = b.customer_id
     JOIN provider_profiles p ON p.id = b.provider_id
     JOIN services s ON s.id = b.service_id
     LEFT JOIN conversations c ON c.customer_id = b.customer_id
       AND c.provider_id = b.provider_id AND c.service_id = b.service_id
     LEFT JOIN reviews r ON r.booking_id = b.id
     WHERE b.id::text = $1
       AND (b.customer_id = $2 OR (p.user_id = $2 AND b.provider_deleted_at IS NULL))
     LIMIT 1`,
    [bookingId, session.user.id],
  );
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  return NextResponse.json({ booking: {
    id: row.id,
    viewerRole: row.customer_id === session.user.id ? "customer" : "provider",
    customerName: row.customer_name,
    providerId: row.provider_id,
    providerName: row.provider_name,
    serviceId: row.service_id,
    serviceSlug: row.service_slug,
    serviceTitle: row.service_title,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.service_address,
    notes: row.notes,
    price: row.price_cents / 100,
    status: row.status,
    cancelledBy: row.cancelled_by,
    cancellationReason: row.cancellation_reason,
    completedAt: row.completed_at,
    conversationId: row.conversation_id,
    review: row.review_id ? { id: row.review_id, rating: row.rating, body: row.review_body ?? "" } : null,
  } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown; reason?: unknown };
  if (body.action !== "cancel") return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) {
    return NextResponse.json({ error: "Add a brief cancellation reason." }, { status: 400 });
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ provider_user_id: string; service_title: string }>(
      `UPDATE bookings b SET status = 'cancelled', cancelled_by = 'customer', cancellation_reason = $3
       FROM provider_profiles p, services s
       WHERE b.id::text = $1 AND b.customer_id = $2 AND b.status IN ('requested', 'confirmed')
         AND p.id = b.provider_id AND s.id = b.service_id
       RETURNING p.user_id AS provider_user_id, s.title AS service_title`,
      [bookingId, session.user.id, reason],
    );
    const cancelled = result.rows[0];
    if (!cancelled) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking could not be cancelled." }, { status: 409 });
    }
    await client.query(
      `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
       VALUES ($1, $2::uuid, 'booking_cancelled', 'Booking cancelled', $3, '/provider/dashboard/bookings/' || $2::uuid::text, 'booking-cancelled-' || $2::uuid::text || '-provider')
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [cancelled.provider_user_id, bookingId, `${session.user.name || "The customer"} cancelled ${cancelled.service_title}: ${reason}`],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Customer booking cancellation failed", error);
    return NextResponse.json({ error: "We could not cancel this booking. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
