import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

type BookingAction = "accepted" | "declined" | "completed";

export async function PATCH(request: Request, context: RouteContext<"/api/providers/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown };
  const action = body.action as BookingAction;
  if (!(["accepted", "declined", "completed"] as BookingAction[]).includes(action)) {
    return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const bookingResult = await client.query<{
      id: string; provider_id: string; starts_at: Date; ends_at: Date; status: string;
    }>(
      `SELECT b.id::text, b.provider_id::text, b.starts_at, b.ends_at, b.status
       FROM bookings b
       JOIN provider_profiles p ON p.id = b.provider_id
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
      await client.query("UPDATE bookings SET status = 'completed' WHERE id::text = $1", [bookingId]);
    } else if (action === "declined") {
      if (booking.status !== "requested") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Only new requests can be declined." }, { status: 409 });
      }
      await client.query("UPDATE bookings SET status = 'cancelled' WHERE id::text = $1", [bookingId]);
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
        `UPDATE bookings SET status = 'cancelled'
         WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'requested'
           AND starts_at < $4 AND ends_at > $3`,
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
