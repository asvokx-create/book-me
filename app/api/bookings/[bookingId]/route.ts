import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function PATCH(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown };
  if (body.action !== "cancel") return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ provider_user_id: string; service_title: string }>(
      `UPDATE bookings b SET status = 'cancelled'
       FROM provider_profiles p, services s
       WHERE b.id::text = $1 AND b.customer_id = $2 AND b.status IN ('requested', 'confirmed')
         AND p.id = b.provider_id AND s.id = b.service_id
       RETURNING p.user_id AS provider_user_id, s.title AS service_title`,
      [bookingId, session.user.id],
    );
    const cancelled = result.rows[0];
    if (!cancelled) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking could not be cancelled." }, { status: 409 });
    }
    await client.query(
      `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
       VALUES ($1, $2, 'booking_cancelled', 'Booking cancelled', $3, '/provider/dashboard/bookings', 'booking-cancelled-' || $2::text || '-provider')
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [cancelled.provider_user_id, bookingId, `${session.user.name || "The customer"} cancelled ${cancelled.service_title}.`],
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
