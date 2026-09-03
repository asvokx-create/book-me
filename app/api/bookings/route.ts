import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await database.query<{
    id: string; service: string; service_slug: string; category: string; provider: string;
    starts_at: Date; price_cents: number; location: string; status: "requested" | "confirmed" | "completed" | "cancelled";
  }>(
    `SELECT b.id::text, s.title AS service, s.slug AS service_slug, s.category,
            p.business_name AS provider, b.starts_at, b.price_cents,
            b.service_address AS location, b.status
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN provider_profiles p ON p.id = b.provider_id
     WHERE b.customer_id = $1
     ORDER BY b.starts_at DESC`,
    [session.user.id],
  );
  return NextResponse.json({ bookings: result.rows.map((row) => ({
    id: row.id, service: row.service, serviceSlug: row.service_slug, category: row.category,
    provider: row.provider, startsAt: row.starts_at, price: row.price_cents / 100,
    location: row.location, state: row.status,
  })) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in before requesting a booking." }, { status: 401 });

  const body = (await request.json()) as { serviceId?: unknown; date?: unknown; time?: unknown; location?: unknown };
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  if (!serviceId || !datePattern.test(date) || !timePattern.test(time) || !location || location.length > 200) {
    return NextResponse.json({ error: "Complete the location, date, and time fields." }, { status: 400 });
  }

  const serviceResult = await database.query<{
    id: string; provider_id: string; duration_minutes: number; price_cents: number;
    start_time: string; end_time: string; timezone: string;
  }>(
    `SELECT s.id::text, s.provider_id::text, s.duration_minutes, s.price_cents,
            a.start_time::text, a.end_time::text, a.timezone
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id AND p.is_active = true
     JOIN availability a ON a.provider_id = s.provider_id
       AND a.weekday = EXTRACT(DOW FROM $2::date)
     WHERE s.id::text = $1 AND s.is_active = true
     LIMIT 1`,
    [serviceId, date],
  );
  const service = serviceResult.rows[0];
  if (!service) return NextResponse.json({ error: "This provider is not available on that day." }, { status: 409 });

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  };
  const requestedMinutes = toMinutes(time);
  const startMinutes = toMinutes(service.start_time);
  const endMinutes = toMinutes(service.end_time);
  if (requestedMinutes < startMinutes || requestedMinutes + service.duration_minutes > endMinutes || (requestedMinutes - startMinutes) % 30 !== 0) {
    return NextResponse.json({ error: "That time is outside the provider's working hours." }, { status: 409 });
  }

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
    const conflict = await client.query(
      `SELECT 1 FROM bookings
       WHERE provider_id::text = $1
         AND starts_at < $3 AND ends_at > $2
         AND (status = 'confirmed' OR (customer_id = $4 AND status = 'requested'))
       LIMIT 1`,
      [service.provider_id, startsAt, endsAt, session.user.id],
    );
    if (conflict.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That time is already booked or requested. Choose another available time." }, { status: 409 });
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO bookings (customer_id, provider_id, service_id, starts_at, ends_at, service_address, price_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [session.user.id, service.provider_id, service.id, startsAt, endsAt, location, service.price_cents],
    );
    await client.query("COMMIT");
    return NextResponse.json({ id: created.rows[0].id, status: "requested" }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Booking request failed", error);
    return NextResponse.json({ error: "We could not send your request. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
