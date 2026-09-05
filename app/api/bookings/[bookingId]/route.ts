import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { sendBookingUpdateEmails } from "@/lib/booking-email";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function GET(_request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const result = await database.query<{
    id: string; customer_id: string; customer_name: string; provider_id: string; provider_name: string;
    service_id: string; service_slug: string; service_title: string; category: string; starts_at: Date; ends_at: Date;
    service_address: string; notes: string; price_cents: number; status: string; cancelled_by: string | null;
    cancellation_reason: string | null; late_cancellation: boolean; cancellation_window_hours: number;
    cancellation_policy: string; completed_at: Date | null; conversation_id: string | null;
    review_id: string | null; rating: number | null; review_body: string | null; reschedule_requested_by: string | null;
    reschedule_starts_at: Date | null; reschedule_ends_at: Date | null; reschedule_reason: string | null; reschedule_requested_at: Date | null;
    assigned_team_member_id: string | null; assignee_name: string; quote_status: string;
    quoted_price_cents: number | null; quote_message: string; quote_sent_at: Date | null; quote_responded_at: Date | null;
  }>(
    `SELECT b.id::text, b.customer_id, customer.name AS customer_name, b.provider_id::text,
            p.business_name AS provider_name, b.service_id::text, s.slug AS service_slug, s.title AS service_title,
            s.category, b.starts_at, b.ends_at, b.service_address, b.notes, b.price_cents, b.status,
            b.cancelled_by, b.cancellation_reason, b.late_cancellation, p.cancellation_window_hours,
            p.cancellation_policy, b.completed_at, b.reschedule_requested_by,
            b.reschedule_starts_at, b.reschedule_ends_at, b.reschedule_reason, b.reschedule_requested_at,
            b.quote_status, b.quoted_price_cents, b.quote_message, b.quote_sent_at, b.quote_responded_at,
            b.assigned_team_member_id::text, COALESCE(member.name, 'Company owner') AS assignee_name,
            c.id::text AS conversation_id, r.id::text AS review_id, r.rating, r.body AS review_body
     FROM bookings b JOIN "user" customer ON customer.id = b.customer_id
     JOIN provider_profiles p ON p.id = b.provider_id JOIN services s ON s.id = b.service_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     LEFT JOIN conversations c ON c.customer_id = b.customer_id AND c.provider_id = b.provider_id AND c.service_id = b.service_id
     LEFT JOIN reviews r ON r.booking_id = b.id AND r.is_hidden = false
     WHERE b.id::text = $1 AND (b.customer_id = $2 OR (p.user_id = $2 AND b.provider_deleted_at IS NULL)) LIMIT 1`,
    [bookingId, session.user.id],
  );
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const history = await database.query<{ id: string; event_type: string; message: string; created_at: Date }>(
    `SELECT id::text, event_type, message, created_at FROM booking_events WHERE booking_id::text = $1 ORDER BY created_at DESC`, [bookingId],
  );
  const team = row.customer_id === session.user.id ? [] : (await database.query<{ id: string; name: string }>(
    `SELECT id::text, name FROM provider_team_members WHERE provider_id::text = $1 AND status = 'active' ORDER BY name`, [row.provider_id])).rows;
  return NextResponse.json({ booking: {
    id: row.id, viewerRole: row.customer_id === session.user.id ? "customer" : "provider", customerName: row.customer_name,
    providerId: row.provider_id, providerName: row.provider_name, serviceId: row.service_id, serviceSlug: row.service_slug,
    serviceTitle: row.service_title, category: row.category, startsAt: row.starts_at, endsAt: row.ends_at,
    location: row.service_address, notes: row.notes, price: row.price_cents / 100, status: row.status,
    cancelledBy: row.cancelled_by, cancellationReason: row.cancellation_reason, completedAt: row.completed_at,
    lateCancellation: row.late_cancellation, cancellationWindowHours: row.cancellation_window_hours,
    cancellationPolicy: row.cancellation_policy,
    conversationId: row.conversation_id,
    assignedTeamMemberId: row.assigned_team_member_id,
    assigneeName: row.assignee_name,
    quote: { status: row.quote_status, price: row.quoted_price_cents === null ? null : row.quoted_price_cents / 100,
      message: row.quote_message, sentAt: row.quote_sent_at, respondedAt: row.quote_responded_at },
    teamMembers: team,
    reschedule: row.reschedule_starts_at ? { requestedBy: row.reschedule_requested_by, startsAt: row.reschedule_starts_at,
      endsAt: row.reschedule_ends_at, reason: row.reschedule_reason, requestedAt: row.reschedule_requested_at } : null,
    history: history.rows.map((event) => ({ id: event.id, type: event.event_type, message: event.message, createdAt: event.created_at })),
    review: row.review_id ? { id: row.review_id, rating: row.rating, body: row.review_body ?? "" } : null,
  } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "customer-booking-update", limit: 12 }))
    return NextResponse.json({ error: "Too many booking changes. Please wait a minute and try again." }, { status: 429 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown; reason?: unknown; startsAt?: unknown };
  const action = body.action;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!["cancel", "request_reschedule", "accept_quote", "decline_quote"].includes(String(action))) return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });
  if ((action === "cancel" || action === "request_reschedule") && (reason.length < 3 || reason.length > 500)) return NextResponse.json({ error: "Add a brief reason." }, { status: 400 });
  if (reason) { const safety = await checkAndRecordContent({ userId: session.user.id, surface: action === "cancel" ? "booking_cancellation" : "booking_reschedule", fields: [reason] }); if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 }); }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ provider_id: string; provider_user_id: string; service_title: string; status: string; duration_minutes: number; assigned_team_member_id: string | null; starts_at: Date; cancellation_window_hours: number; quote_status: string; quoted_price_cents: number | null }>(
      `SELECT b.provider_id::text, p.user_id AS provider_user_id, s.title AS service_title, b.status, s.duration_minutes,
              b.starts_at, p.cancellation_window_hours, b.quote_status, b.quoted_price_cents,
              b.assigned_team_member_id::text
       FROM bookings b JOIN provider_profiles p ON p.id = b.provider_id JOIN services s ON s.id = b.service_id
       WHERE b.id::text = $1 AND b.customer_id = $2 FOR UPDATE OF b`, [bookingId, session.user.id],
    );
    const booking = result.rows[0];
    if (!booking || !["requested", "confirmed"].includes(booking.status)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 409 });
    }
    if (action === "accept_quote" || action === "decline_quote") {
      if (booking.status !== "requested" || booking.quote_status !== "pending" || booking.quoted_price_cents === null) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This quote is no longer awaiting your response." }, { status: 409 }); }
      const accepted = action === "accept_quote";
      await client.query(`UPDATE bookings SET quote_status = $2, quote_responded_at = now(),
        price_cents = CASE WHEN $2 = 'accepted' THEN quoted_price_cents ELSE price_cents END WHERE id::text = $1`, [bookingId, accepted ? "accepted" : "declined"]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, $3, $4)`, [bookingId, session.user.id, accepted ? "quote_accepted" : "quote_declined", accepted ? "Customer approved the provider's quote." : "Customer declined the provider's quote."]);
      await client.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
        VALUES ($1, $2::uuid, 'booking_quote', $3, $4, '/provider/dashboard/bookings/' || $2::uuid::text,
        $5 || '-' || extract(epoch from now())::bigint)`, [booking.provider_user_id, bookingId, accepted ? "Quote approved" : "Quote declined", `${session.user.name || "The customer"} ${accepted ? "approved" : "declined"} your quote for ${booking.service_title}.`, action]);
    } else if (action === "cancel") {
      const noticeDeadline = booking.starts_at.getTime() - booking.cancellation_window_hours * 60 * 60 * 1000;
      const lateCancellation = booking.status === "confirmed" && booking.cancellation_window_hours > 0 && Date.now() > noticeDeadline;
      await client.query(`UPDATE bookings SET status = 'cancelled', cancelled_by = 'customer', cancellation_reason = $2,
        late_cancellation = $3,
        reschedule_requested_by = NULL, reschedule_starts_at = NULL, reschedule_ends_at = NULL, reschedule_reason = NULL,
        reschedule_requested_at = NULL WHERE id::text = $1`, [bookingId, reason, lateCancellation]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
        VALUES ($1::uuid, $2, 'cancelled', $3)`, [bookingId, session.user.id, `${lateCancellation ? "Late cancellation" : "Customer cancelled the booking"}: ${reason}`]);
      await client.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
        VALUES ($1, $2::uuid, 'booking_cancelled', 'Booking cancelled', $3, '/provider/dashboard/bookings/' || $2::uuid::text,
        'booking-cancelled-' || $2::uuid::text || '-provider') ON CONFLICT (dedupe_key) DO NOTHING`,
        [booking.provider_user_id, bookingId, `${session.user.name || "The customer"} cancelled ${booking.service_title}: ${reason}`]);
    } else {
      const start = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(Number.NaN);
      if (Number.isNaN(start.getTime()) || start <= new Date()) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Choose a future date and time." }, { status: 400 }); }
      const end = new Date(start.getTime() + booking.duration_minutes * 60_000);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [booking.provider_id]);
      const available = await client.query(`WITH hours AS (
        SELECT a.weekday, a.start_time, a.end_time, a.timezone FROM availability a
          WHERE a.provider_id::text = $1 AND $4::uuid IS NULL
        UNION ALL
        SELECT worker.weekday, worker.start_time, worker.end_time, worker.timezone FROM team_member_availability worker
          JOIN provider_team_members member ON member.id = worker.team_member_id
          WHERE member.provider_id::text = $1 AND member.id = $4::uuid AND member.status = 'active'
      ) SELECT 1 FROM hours WHERE weekday = EXTRACT(DOW FROM $2::timestamptz AT TIME ZONE timezone)
        AND ($2::timestamptz AT TIME ZONE timezone)::time >= start_time
        AND ($3::timestamptz AT TIME ZONE timezone)::time <= end_time LIMIT 1`, [booking.provider_id, start, end, booking.assigned_team_member_id]);
      const conflict = await client.query(`SELECT 1 FROM bookings WHERE provider_id::text = $1 AND id::text <> $2
        AND assigned_team_member_id IS NOT DISTINCT FROM $3::uuid AND status = 'confirmed' AND starts_at < $5 AND ends_at > $4 LIMIT 1`, [booking.provider_id, bookingId, booking.assigned_team_member_id, start, end]);
      const blocked = await client.query(`SELECT 1 FROM provider_time_off WHERE provider_id::text = $1
        AND team_member_id IS NOT DISTINCT FROM $2::uuid AND starts_at < $4 AND ends_at > $3 LIMIT 1`, [booking.provider_id, booking.assigned_team_member_id, start, end]);
      if (!available.rowCount || conflict.rowCount || blocked.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "That time is outside the assigned professional's hours or already booked." }, { status: 409 }); }
      await client.query(`UPDATE bookings SET reschedule_requested_by = 'customer', reschedule_starts_at = $2,
        reschedule_ends_at = $3, reschedule_reason = $4, reschedule_requested_at = now() WHERE id::text = $1`, [bookingId, start, end, reason]);
      await client.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message, metadata)
        VALUES ($1::uuid, $2, 'reschedule_requested', $3, jsonb_build_object('startsAt', $4::timestamptz))`,
        [bookingId, session.user.id, `Customer requested a new time: ${reason}`, start]);
      await client.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
        VALUES ($1, $2::uuid, 'booking_reschedule', 'New reschedule request', $3, '/provider/dashboard/bookings/' || $2::uuid::text,
        'booking-reschedule-' || $2::uuid::text || '-' || extract(epoch from now())::bigint)`,
        [booking.provider_user_id, bookingId, `${session.user.name || "The customer"} requested a new time for ${booking.service_title}.`]);
    }
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: String(action), targetType: "booking", targetId: bookingId });
    if (action === "cancel") await sendBookingUpdateEmails(bookingId, "cancelled");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK"); console.error("Customer booking update failed", error);
    return NextResponse.json({ error: "We could not update this booking. Please try again." }, { status: 500 });
  } finally { client.release(); }
}
