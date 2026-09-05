import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { sendBookingUpdateEmails } from "@/lib/booking-email";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await database.query<{
    id: string; service_id: string; provider_id: string; service: string; service_slug: string; category: string; provider: string;
    starts_at: Date; price_cents: number; location: string; status: "requested" | "confirmed" | "completed" | "cancelled"; assignee_name: string;
  }>(
    `SELECT b.id::text, s.id::text AS service_id, p.id::text AS provider_id,
            s.title AS service, s.slug AS service_slug, s.category,
            p.business_name AS provider, b.starts_at, b.price_cents,
            b.service_address AS location, b.status, COALESCE(member.name, 'Company owner') AS assignee_name
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN provider_profiles p ON p.id = b.provider_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     WHERE b.customer_id = $1
     ORDER BY b.starts_at DESC`,
    [session.user.id],
  );
  return NextResponse.json({ bookings: result.rows.map((row) => ({
    id: row.id, serviceId: row.service_id, providerId: row.provider_id,
    service: row.service, serviceSlug: row.service_slug, category: row.category,
    provider: row.provider, startsAt: row.starts_at, price: row.price_cents / 100,
    location: row.location, state: row.status,
    assigneeName: row.assignee_name,
  })) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in before requesting a booking." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "booking-create", limit: 8 })) {
    return NextResponse.json({ error: "Too many booking requests. Please wait a minute and try again." }, { status: 429 });
  }

  const body = (await request.json()) as { serviceId?: unknown; date?: unknown; time?: unknown; location?: unknown; notes?: unknown };
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!serviceId || !datePattern.test(date) || !timePattern.test(time) || !location || location.length > 200 || notes.length > 1000) {
    return NextResponse.json({ error: "Complete the location, date, and time fields." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "booking", fields: [location, notes] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });

  const serviceResult = await database.query<{
    id: string; provider_id: string; duration_minutes: number; price_cents: number;
    timezone: string; provider_user_id: string; title: string;
  }>(
    `SELECT s.id::text, s.provider_id::text, s.duration_minutes, s.price_cents, s.title,
            COALESCE((SELECT timezone FROM availability WHERE provider_id = p.id LIMIT 1),
                     (SELECT hours.timezone FROM team_member_availability hours JOIN provider_team_members member ON member.id = hours.team_member_id WHERE member.provider_id = p.id LIMIT 1),
                     'America/Los_Angeles') AS timezone,
            p.user_id AS provider_user_id
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id AND p.is_active = true
     WHERE s.id::text = $1 AND s.is_active = true
     LIMIT 1`,
    [serviceId],
  );
  const service = serviceResult.rows[0];
  if (!service) return NextResponse.json({ error: "This provider is not available on that day." }, { status: 409 });

  if (Number(time.slice(3, 5)) % 30 !== 0) return NextResponse.json({ error: "Choose a listed 30-minute time." }, { status: 409 });

  const timeResult = await database.query<{ starts_at: Date; ends_at: Date }>(
    `SELECT (($1::date + $2::time) AT TIME ZONE $3) AS starts_at,
            (($1::date + $2::time) AT TIME ZONE $3) + make_interval(mins => $4) AS ends_at`,
    [date, time, service.timezone, service.duration_minutes],
  );
  const { starts_at: startsAt, ends_at: endsAt } = timeResult.rows[0];
  if (startsAt <= new Date()) return NextResponse.json({ error: "Choose a future time." }, { status: 409 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [service.provider_id]);
    const candidate = await client.query<{ member_id: string | null; name: string }>(
      `WITH staff_hours AS (
         SELECT NULL::uuid AS member_id, 'Company owner'::text AS name, a.weekday, a.start_time, a.end_time, a.timezone, 0 AS priority
         FROM availability a WHERE a.provider_id::text = $1
         UNION ALL
         SELECT member.id, member.name, hours.weekday, hours.start_time, hours.end_time, hours.timezone, 1 AS priority
         FROM provider_team_members member JOIN team_member_availability hours ON hours.team_member_id = member.id
         WHERE member.provider_id::text = $1 AND member.status = 'active'
       )
       SELECT staff.member_id::text, staff.name FROM staff_hours staff
       WHERE staff.weekday = EXTRACT(DOW FROM $2::timestamptz AT TIME ZONE staff.timezone)
         AND ($2::timestamptz AT TIME ZONE staff.timezone)::time >= staff.start_time
         AND ($3::timestamptz AT TIME ZONE staff.timezone)::time <= staff.end_time
         AND NOT EXISTS (SELECT 1 FROM provider_time_off blocked WHERE blocked.provider_id::text = $1
           AND blocked.team_member_id IS NOT DISTINCT FROM staff.member_id AND blocked.starts_at < $3 AND blocked.ends_at > $2)
         AND NOT EXISTS (SELECT 1 FROM bookings existing WHERE existing.provider_id::text = $1
           AND existing.assigned_team_member_id IS NOT DISTINCT FROM staff.member_id AND existing.status = 'confirmed'
           AND existing.starts_at < $3 AND existing.ends_at > $2)
         AND NOT EXISTS (SELECT 1 FROM bookings own_request WHERE own_request.customer_id = $4 AND own_request.provider_id::text = $1
           AND own_request.status = 'requested' AND own_request.starts_at < $3 AND own_request.ends_at > $2)
       ORDER BY staff.priority, staff.name LIMIT 1`,
      [service.provider_id, startsAt, endsAt, session.user.id],
    );
    if (!candidate.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That time is no longer available. Choose another listed time." }, { status: 409 });
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO bookings (customer_id, provider_id, service_id, starts_at, ends_at, service_address, notes, price_cents, assigned_team_member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::uuid)
       RETURNING id::text`,
      [session.user.id, service.provider_id, service.id, startsAt, endsAt, location, notes, service.price_cents, candidate.rows[0].member_id],
    );
    const bookingId = created.rows[0].id;
    await client.query(
      `INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
       VALUES ($1::uuid, $2, 'requested', $3)`,
      [bookingId, session.user.id, `Customer sent the booking request. Assigned to ${candidate.rows[0].name}.`],
    );
    await client.query(
      `INSERT INTO conversations (customer_id, provider_id, service_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (customer_id, provider_id, service_id) WHERE service_id IS NOT NULL DO UPDATE
         SET customer_deleted_at = NULL, provider_deleted_at = NULL, updated_at = now()`,
      [session.user.id, service.provider_id, service.id],
    );
    await client.query(
      `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
       VALUES
         ($1, $3::uuid, 'booking_requested', 'New booking request', $4, '/provider/dashboard/bookings', 'booking-requested-' || ($3::uuid)::text || '-provider'),
         ($2, $3::uuid, 'booking_requested', 'Booking request sent', $5, '/account/bookings/' || ($3::uuid)::text, 'booking-requested-' || ($3::uuid)::text || '-customer')
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [
        service.provider_user_id,
        session.user.id,
        bookingId,
        `${session.user.name || "A customer"} requested ${service.title}.`,
        `Your request for ${service.title} was sent to the provider.`,
      ],
    );
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: "booking_created", targetType: "booking", targetId: bookingId });
    await sendBookingUpdateEmails(bookingId, "requested");
    return NextResponse.json({ id: bookingId, status: "requested" }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Booking request failed", error);
    return NextResponse.json({ error: "We could not send your request. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
