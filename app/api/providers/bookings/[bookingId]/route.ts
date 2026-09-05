import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { sendBookingUpdateEmails } from "@/lib/booking-email";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

type BookingAction = "accepted" | "declined" | "completed" | "cancel" | "approve_reschedule" | "decline_reschedule" | "assign";

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
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "provider-booking-update", limit: 20 })) {
    return NextResponse.json({ error: "Too many booking changes. Please wait a minute and try again." }, { status: 429 });
  }
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown; reason?: unknown; memberId?: unknown };
  const action = body.action as BookingAction;
  if (!(["accepted", "declined", "completed", "cancel", "approve_reschedule", "decline_reschedule", "assign"] as BookingAction[]).includes(action)) {
    return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if ((action === "declined" || action === "cancel" || action === "decline_reschedule") && (reason.length < 3 || reason.length > 500)) {
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
      reschedule_starts_at: Date | null; reschedule_ends_at: Date | null; reschedule_reason: string | null;
      assigned_team_member_id: string | null;
    }>(
      `SELECT b.id::text, b.provider_id::text, b.starts_at, b.ends_at, b.status,
              b.customer_id, u.name AS customer_name, s.title AS service_title,
              b.reschedule_starts_at, b.reschedule_ends_at, b.reschedule_reason, b.assigned_team_member_id::text
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

    if (action === "assign") {
      if (!["requested", "confirmed"].includes(booking.status)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This booking can no longer be assigned." }, { status: 409 }); }
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.provider_id]);
      const memberId = body.memberId === "owner" || body.memberId === null ? null : typeof body.memberId === "string" ? body.memberId : "";
      if (memberId === "") { await client.query("ROLLBACK"); return NextResponse.json({ error: "Choose a valid staff member." }, { status: 400 }); }
      let assigneeName = "Company owner";
      if (memberId) {
        const member = await client.query<{ name: string }>("SELECT name FROM provider_team_members WHERE id::text = $1 AND provider_id::text = $2 AND status = 'active'", [memberId, booking.provider_id]);
        if (!member.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Worker not found." }, { status: 404 }); }
        assigneeName = member.rows[0].name;
      }
      const working = await client.query(`WITH hours AS (
        SELECT a.weekday, a.start_time, a.end_time, a.timezone FROM availability a WHERE a.provider_id::text = $1 AND $4::uuid IS NULL
        UNION ALL SELECT worker.weekday, worker.start_time, worker.end_time, worker.timezone FROM team_member_availability worker
          JOIN provider_team_members member ON member.id = worker.team_member_id
          WHERE member.provider_id::text = $1 AND member.id = $4::uuid AND member.status = 'active'
      ) SELECT 1 FROM hours WHERE weekday = EXTRACT(DOW FROM $2::timestamptz AT TIME ZONE timezone)
        AND ($2::timestamptz AT TIME ZONE timezone)::time >= start_time AND ($3::timestamptz AT TIME ZONE timezone)::time <= end_time LIMIT 1`,
        [booking.provider_id, booking.starts_at, booking.ends_at, memberId]);
      const conflict = await client.query(`SELECT 1 FROM bookings WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'confirmed'
        AND assigned_team_member_id IS NOT DISTINCT FROM $3::uuid AND starts_at < $5 AND ends_at > $4 LIMIT 1`,
        [booking.provider_id, bookingId, memberId, booking.starts_at, booking.ends_at]);
      const blocked = await client.query(`SELECT 1 FROM provider_time_off WHERE provider_id::text = $1
        AND team_member_id IS NOT DISTINCT FROM $2::uuid AND starts_at < $4 AND ends_at > $3 LIMIT 1`,
        [booking.provider_id, memberId, booking.starts_at, booking.ends_at]);
      if (!working.rowCount || conflict.rowCount || blocked.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: `${assigneeName} is unavailable at this time.` }, { status: 409 }); }
      await client.query("UPDATE bookings SET assigned_team_member_id = $2::uuid WHERE id::text = $1", [bookingId, memberId]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, 'assigned', $3)`, [bookingId, session.user.id, `Booking assigned to ${assigneeName}.`]);
    } else if (action === "approve_reschedule" || action === "decline_reschedule") {
      if (!booking.reschedule_starts_at || !booking.reschedule_ends_at || !["requested", "confirmed"].includes(booking.status)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "There is no active reschedule request." }, { status: 409 });
      }
      if (action === "approve_reschedule") {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.provider_id]);
        const conflict = await client.query(
          `SELECT 1 FROM bookings WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'confirmed'
             AND assigned_team_member_id IS NOT DISTINCT FROM $3::uuid AND starts_at < $5 AND ends_at > $4 LIMIT 1`,
          [booking.provider_id, bookingId, booking.assigned_team_member_id, booking.reschedule_starts_at, booking.reschedule_ends_at],
        );
        const blocked = await client.query(`SELECT 1 FROM provider_time_off WHERE provider_id::text = $1
          AND team_member_id IS NOT DISTINCT FROM $2::uuid AND starts_at < $4 AND ends_at > $3 LIMIT 1`,
          [booking.provider_id, booking.assigned_team_member_id, booking.reschedule_starts_at, booking.reschedule_ends_at]);
        const working = await client.query(`WITH hours AS (
          SELECT a.weekday, a.start_time, a.end_time, a.timezone FROM availability a WHERE a.provider_id::text = $1 AND $4::uuid IS NULL
          UNION ALL SELECT worker.weekday, worker.start_time, worker.end_time, worker.timezone FROM team_member_availability worker
            JOIN provider_team_members member ON member.id = worker.team_member_id
            WHERE member.provider_id::text = $1 AND member.id = $4::uuid AND member.status = 'active'
        ) SELECT 1 FROM hours WHERE weekday = EXTRACT(DOW FROM $2::timestamptz AT TIME ZONE timezone)
          AND ($2::timestamptz AT TIME ZONE timezone)::time >= start_time AND ($3::timestamptz AT TIME ZONE timezone)::time <= end_time LIMIT 1`,
          [booking.provider_id, booking.reschedule_starts_at, booking.reschedule_ends_at, booking.assigned_team_member_id]);
        if (!working.rowCount || conflict.rowCount || blocked.rowCount) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "That requested time is no longer available." }, { status: 409 });
        }
        await client.query(`UPDATE bookings SET starts_at = reschedule_starts_at, ends_at = reschedule_ends_at,
          status = CASE WHEN status = 'requested' THEN 'confirmed' ELSE status END,
          reschedule_requested_by = NULL, reschedule_starts_at = NULL, reschedule_ends_at = NULL,
          reschedule_reason = NULL, reschedule_requested_at = NULL WHERE id::text = $1`, [bookingId]);
        await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
          VALUES ($1::uuid, $2, 'reschedule_approved', 'Provider approved the new booking time.')`, [bookingId, session.user.id]);
        await client.query(`WITH cancelled AS (
          UPDATE bookings SET status = 'cancelled', cancelled_by = 'system',
            cancellation_reason = 'The provider accepted another booking for this time.'
          WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'requested'
            AND assigned_team_member_id IS NOT DISTINCT FROM $5::uuid
            AND starts_at < $4 AND ends_at > $3 RETURNING id, customer_id, service_id
        ), events AS (
          INSERT INTO booking_events (booking_id, event_type, message)
          SELECT id, 'cancelled', 'Requested time became unavailable after another booking was confirmed.' FROM cancelled
          RETURNING booking_id
        )
        INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
        SELECT cancelled.customer_id, cancelled.id, 'booking_declined', 'Requested time unavailable',
          'Another booking was confirmed for the time you requested for ' || s.title || '. Please choose another time.',
          '/account/bookings/' || cancelled.id::text, 'booking-conflict-' || cancelled.id::text || '-customer'
        FROM cancelled JOIN services s ON s.id = cancelled.service_id JOIN events ON events.booking_id = cancelled.id
        ON CONFLICT (dedupe_key) DO NOTHING`, [booking.provider_id, bookingId, booking.reschedule_starts_at, booking.reschedule_ends_at, booking.assigned_team_member_id]);
      } else {
        await client.query(`UPDATE bookings SET reschedule_requested_by = NULL, reschedule_starts_at = NULL,
          reschedule_ends_at = NULL, reschedule_reason = NULL, reschedule_requested_at = NULL WHERE id::text = $1`, [bookingId]);
        await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
          VALUES ($1::uuid, $2, 'reschedule_declined', $3)`, [bookingId, session.user.id, `Provider declined the new time: ${reason}`]);
      }
      await client.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
        VALUES ($1, $2::uuid, 'booking_reschedule', $3, $4, '/account/bookings/' || $2::uuid::text,
        $5 || '-' || extract(epoch from now())::bigint)`, [booking.customer_id, bookingId,
        action === "approve_reschedule" ? "New booking time approved" : "Reschedule request declined",
        action === "approve_reschedule" ? `${booking.service_title} has been moved to your requested time.` : `${booking.service_title}: ${reason}`,
        action]);
    } else if (action === "completed") {
      if (booking.status !== "confirmed") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Only accepted bookings can be completed." }, { status: 409 });
      }
      if (booking.ends_at > new Date()) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This job can be completed after its scheduled end time." }, { status: 409 });
      }
      await client.query("UPDATE bookings SET status = 'completed', completed_at = now() WHERE id::text = $1", [bookingId]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, 'completed', 'Provider marked the service complete.')`, [bookingId, session.user.id]);
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
        `UPDATE bookings SET status = 'cancelled', cancelled_by = 'provider', cancellation_reason = $2,
          reschedule_requested_by = NULL, reschedule_starts_at = NULL, reschedule_ends_at = NULL,
          reschedule_reason = NULL, reschedule_requested_at = NULL WHERE id::text = $1`,
        [bookingId, reason],
      );
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, 'cancelled', $3)`, [bookingId, session.user.id, `Provider ${action === "declined" ? "declined" : "cancelled"} the booking: ${reason}`]);
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
      const working = await client.query(`WITH hours AS (
        SELECT a.weekday, a.start_time, a.end_time, a.timezone FROM availability a WHERE a.provider_id::text = $1 AND $4::uuid IS NULL
        UNION ALL SELECT worker.weekday, worker.start_time, worker.end_time, worker.timezone FROM team_member_availability worker
          JOIN provider_team_members member ON member.id = worker.team_member_id
          WHERE member.provider_id::text = $1 AND member.id = $4::uuid AND member.status = 'active'
      ) SELECT 1 FROM hours WHERE weekday = EXTRACT(DOW FROM $2::timestamptz AT TIME ZONE timezone)
        AND ($2::timestamptz AT TIME ZONE timezone)::time >= start_time AND ($3::timestamptz AT TIME ZONE timezone)::time <= end_time LIMIT 1`,
        [booking.provider_id, booking.starts_at, booking.ends_at, booking.assigned_team_member_id]);
      const conflict = await client.query(
        `SELECT 1 FROM bookings
         WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'confirmed'
           AND assigned_team_member_id IS NOT DISTINCT FROM $3::uuid AND starts_at < $5 AND ends_at > $4
         LIMIT 1`,
        [booking.provider_id, bookingId, booking.assigned_team_member_id, booking.starts_at, booking.ends_at],
      );
      const blocked = await client.query(`SELECT 1 FROM provider_time_off WHERE provider_id::text = $1
        AND team_member_id IS NOT DISTINCT FROM $2::uuid AND starts_at < $4 AND ends_at > $3 LIMIT 1`,
        [booking.provider_id, booking.assigned_team_member_id, booking.starts_at, booking.ends_at]);
      if (!working.rowCount || conflict.rowCount || blocked.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This time is already booked." }, { status: 409 });
      }
      await client.query("UPDATE bookings SET status = 'confirmed' WHERE id::text = $1", [bookingId]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, 'confirmed', 'Provider accepted the booking request.')`, [bookingId, session.user.id]);
      await client.query(
        `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         VALUES ($1, $2::uuid, 'booking_accepted', 'Booking confirmed', $3, '/account/bookings/' || $2::uuid::text, 'booking-accepted-' || $2::uuid::text || '-customer')
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.customer_id, bookingId, `Your ${booking.service_title} booking was accepted.`],
      );
      await client.query(
        `WITH cancelled AS (
           UPDATE bookings SET status = 'cancelled', cancelled_by = 'system',
             cancellation_reason = 'The provider accepted another booking for this time.'
           WHERE provider_id::text = $1 AND id::text <> $2 AND status = 'requested'
             AND assigned_team_member_id IS NOT DISTINCT FROM $5::uuid
             AND starts_at < $4 AND ends_at > $3
           RETURNING id, customer_id, service_id
         ), events AS (
           INSERT INTO booking_events (booking_id, event_type, message)
           SELECT id, 'cancelled', 'Requested time became unavailable after another booking was confirmed.' FROM cancelled
           RETURNING booking_id
         )
         INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
         SELECT cancelled.customer_id, cancelled.id, 'booking_declined', 'Requested time unavailable',
                'Another booking was accepted for the time you requested for ' || s.title || '. Please choose another time.',
                '/account', 'booking-conflict-' || cancelled.id::text || '-customer'
         FROM cancelled JOIN services s ON s.id = cancelled.service_id JOIN events ON events.booking_id = cancelled.id
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.provider_id, bookingId, booking.starts_at, booking.ends_at, booking.assigned_team_member_id],
      );
    }
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action, targetType: "booking", targetId: bookingId });
    if (!action.includes("reschedule") && action !== "assign") await sendBookingUpdateEmails(bookingId, action === "accepted" ? "accepted" : action === "completed" ? "completed" : action === "declined" ? "declined" : "cancelled");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Provider booking update failed", error);
    return NextResponse.json({ error: "We could not update this booking. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
