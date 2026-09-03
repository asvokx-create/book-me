import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  await database.query(
    `INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
     SELECT audience.user_id, b.id, 'booking_reminder', 'Your booking is coming up',
            s.title || ' is scheduled within the next 24 hours.',
            audience.href, 'booking-reminder-' || b.id::text || '-' || audience.user_id
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN provider_profiles p ON p.id = b.provider_id
     CROSS JOIN LATERAL (VALUES
       (b.customer_id, '/account'),
       (p.user_id, '/provider/dashboard/bookings')
     ) AS audience(user_id, href)
     WHERE audience.user_id = $1 AND b.status = 'confirmed'
       AND b.starts_at > now() AND b.starts_at <= now() + interval '24 hours'
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [session.user.id],
  );

  const result = await database.query<{
    id: string; type: string; title: string; message: string; href: string; read_at: Date | null; created_at: Date;
  }>(
    `SELECT id::text, type, title, message, href, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [session.user.id],
  );
  const unreadResult = await database.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [session.user.id],
  );

  return NextResponse.json({
    notifications: result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      href: row.href,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
    })),
    unreadCount: unreadResult.rows[0]?.count ?? 0,
  });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json()) as { notificationId?: unknown; all?: unknown };

  if (body.all === true) {
    await database.query("UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE user_id = $1", [session.user.id]);
    return NextResponse.json({ ok: true });
  }

  const notificationId = typeof body.notificationId === "string" ? body.notificationId : "";
  if (!notificationId) return NextResponse.json({ error: "Choose a notification." }, { status: 400 });
  const result = await database.query(
    "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id::text = $1 AND user_id = $2",
    [notificationId, session.user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
