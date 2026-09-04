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
     LEFT JOIN user_settings us ON us.user_id = audience.user_id
     WHERE audience.user_id = $1 AND b.status = 'confirmed'
       AND COALESCE(us.booking_notifications, true)
       AND b.starts_at > now() AND b.starts_at <= now() + interval '24 hours'
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [session.user.id],
  );

  const result = await database.query<{
    id: string; type: string; title: string; message: string; href: string; read_at: Date | null; created_at: Date;
  }>(
    `SELECT n.id::text, n.type, n.title, n.message, n.href, n.read_at, n.created_at
     FROM notifications n
     LEFT JOIN user_settings us ON us.user_id = n.user_id
     WHERE n.user_id = $1
       AND (CASE WHEN n.type LIKE 'booking_%' THEN COALESCE(us.booking_notifications, true)
                 WHEN n.type = 'new_message' OR n.type LIKE 'message_%' THEN COALESCE(us.message_notifications, true)
                 ELSE true END)
     ORDER BY n.created_at DESC
     LIMIT 30`,
    [session.user.id],
  );
  const unreadResult = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM notifications n
     LEFT JOIN user_settings us ON us.user_id = n.user_id
     WHERE n.user_id = $1 AND n.read_at IS NULL
       AND (CASE WHEN n.type LIKE 'booking_%' THEN COALESCE(us.booking_notifications, true)
                 WHEN n.type = 'new_message' OR n.type LIKE 'message_%' THEN COALESCE(us.message_notifications, true)
                 ELSE true END)`,
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

export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json()) as { notificationId?: unknown; allRead?: unknown };

  if (body.allRead === true) {
    const result = await database.query(
      "DELETE FROM notifications WHERE user_id = $1 AND read_at IS NOT NULL",
      [session.user.id],
    );
    return NextResponse.json({ ok: true, deleted: result.rowCount });
  }

  const notificationId = typeof body.notificationId === "string" ? body.notificationId : "";
  if (!notificationId) return NextResponse.json({ error: "Choose a notification." }, { status: 400 });
  const result = await database.query(
    "DELETE FROM notifications WHERE id::text = $1 AND user_id = $2",
    [notificationId, session.user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
