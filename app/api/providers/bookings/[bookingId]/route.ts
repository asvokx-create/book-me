import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";

type BookingAction = "accepted" | "declined" | "completed" | "cancel";

export async function DELETE(_request: Request, context: RouteContext<"/api/providers/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const result = await database.query(
    `UPDATE bookings b SET provider_deleted_at = now()
     FROM provider_profiles p
     WHERE b.id::text = $1 AND b.provider_id = p.id AND p.user_id = $2
       AND b.status = 'cancelled' AND b.provider_deleted_at IS NULL`,
    [bookingId, session.user.id],
  );
  if (!result.rowCount) {
    return NextResponse.json({ error: "Only cancelled booking requests can be removed." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: RouteContext<"/api/providers/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown; reason?: unknown };
  const action = body.action as BookingAction;
  if (!(["accepted", "declined", "completed", "cancel"] as BookingAction[]).includes(action)) {
    return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if ((action === "declined" || action === "cancel") && (reason.length < 3 || reason.length > 500)) {
    return NextResponse.json({ error: "Add a brief reason so the customer knows what happened." }, { status: 400 });
  }
  if (reason) {
    const safety = await checkAndRecordContent({ userId: session.user.id, surface: "booking_cancellation", fields: [reason] });
    if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const bookingResult = await client.query<{
      id: string; provider_id: string; starts_at: Date; ends_at: Date; status: string;
      customer_id: string; customer_name: string; service_title: string;
    }>(
      `SELECT b.id::text, b.provider_id::text, b.starts_at, b.ends_at, b.status,
              b.customer_id, u.name AS customer_name, s.title AS service_title
       FROM bookings b
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN services s ON s.id = b.service_id
       JOIN "user" u ON u.id = b.customer_id
       WHERE b.id::text = $1 AND p.user_id = $2
       FOR UPDATE OF b`,
      [bookingId, session.user.id],
    );
    const booking = bookingResult.rows[0];
    if (!booking) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (action === "completed") {
      if (booking.status !== "confirmed") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Only accepted bookings can be completed." }, { status: 409 });
      }
      if (booking.ends_at > new Date()) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This job can be completed after its scheduled end time." }, { status: 409 });
      }
      await client.query("UPDATE bookings SET status = 'completed', completed_at = now() WHERE id::text = $1", [bookingId]);
      await client.query(
        `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         VALUES ($1, $2::uuid, 'booking_completed', 'Service completed', $3, '/account/bookings/' || $2::uuid::text, 'booking-completed-' || $2::uuid::text || '-customer')
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.customer_id, bookingId, `${booking.service_title} was marked complete. You can now review your experience.`],
      );
    } else if (action === "declined" || action === "cancel") {
      const allowedStatus = action === "declined" ? "requested" : "confirmed";
      if (booking.status !== allowedStatus) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: action === "declined" ? "Only new requests can be declined." : "Only confirmed bookings can be cancelled." }, { status: 409 });
      }
      await client.query(
        "UPDATE bookings SET status = 'cancelled', cancelled_by = 'provider', cancellation_reason = $2 WHERE id::text = $1",
        [bookingId, reason],
      );
      await client.query(
        `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         VALUES ($1, $2::uuid, 'booking_declined', $3, $4, '/account/bookings/' || $2::uuid::text, $5)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [
          booking.customer_id,
          bookingId,
          action === "declined" ? "Booking request declined" : "Booking cancelled by provider",
          `${booking.service_title}: ${reason}`,
          `${action === "declined" ? "booking-declined" : "booking-cancelled"}-${bookingId}-customer`,
        ],
      );
    } else {
      if (booking.status !== "requested") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Only new requests can be accepted." }, { status: 409 });
      }
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.provider_id]);
      const conflict = await client.query(
        `SELECT 1 FROM bookings
         WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'confirmed'
           AND starts_at < $4 AND ends_at > $3
         LIMIT 1`,
        [booking.provider_id, bookingId, booking.starts_at, booking.ends_at],
      );
      if (conflict.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This time is already booked." }, { status: 409 });
      }
      await client.query("UPDATE bookings SET status = 'confirmed' WHERE id::text = $1", [bookingId]);
      await client.query(
        `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         VALUES ($1, $2::uuid, 'booking_accepted', 'Booking confirmed', $3, '/account/bookings/' || $2::uuid::text, 'booking-accepted-' || $2::uuid::text || '-customer')
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.customer_id, bookingId, `Your ${booking.service_title} booking was accepted.`],
      );
      await client.query(
        `WITH cancelled AS (
           UPDATE bookings SET status = 'cancelled'
           WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'requested'
             AND starts_at < $4 AND ends_at > $3
           RETURNING id, customer_id, service_id
         )
         INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         SELECT cancelled.customer_id, cancelled.id, 'booking_declined', 'Requested time unavailable',
                'Another booking was accepted for the time you requested for ' || s.title || '. Please choose another time.',
                '/account', 'booking-conflict-' || cancelled.id::text || '-customer'
         FROM cancelled JOIN services s ON s.id = cancelled.service_id
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.provider_id, bookingId, booking.starts_at, booking.ends_at],
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Provider booking update failed", error);
    return NextResponse.json({ error: "We could not update this booking. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
