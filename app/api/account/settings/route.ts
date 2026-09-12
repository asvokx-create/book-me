import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

type SettingsRow = {
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  city: string;
  state: string;
  search_radius_miles: number;
  booking_notifications: boolean;
  message_notifications: boolean;
  theme: "light" | "dark" | "system";
  time_zone: string;
  is_provider: boolean;
};

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await database.query<SettingsRow>(
    `SELECT u.name, u.email, u.image, u.phone,
            COALESCE(us.city, p.city, '') AS city,
            COALESCE(us.state, p.state, 'WA') AS state,
            COALESCE(us.search_radius_miles, 25)::int AS search_radius_miles,
            COALESCE(us.booking_notifications, true) AS booking_notifications,
            COALESCE(us.message_notifications, true) AS message_notifications,
            COALESCE(us.theme, 'system') AS theme,
            COALESCE(us.time_zone, 'auto') AS time_zone,
            (p.id IS NOT NULL OR EXISTS (
              SELECT 1
              FROM provider_team_members tm
              WHERE tm.status = 'active'
                AND (tm.user_id = u.id OR (tm.user_id IS NULL AND lower(tm.email) = lower(u.email)))
            )) AS is_provider
     FROM "user" u
     LEFT JOIN user_settings us ON us.user_id = u.id
     LEFT JOIN provider_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [session.user.id],
  );
  const row = result.rows[0];
  if (!row) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  return NextResponse.json({
    name: row.name,
    email: row.email,
    imageUrl: row.image ?? "",
    phone: row.phone ?? "",
    city: row.city,
    state: row.state,
    radius: row.search_radius_miles,
    bookingNotifications: row.booking_notifications,
    messageNotifications: row.message_notifications,
    theme: row.theme,
    timeZone: row.time_zone,
    isProvider: row.is_provider,
  });
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const city = typeof body.city === "string" ? body.city.trim().replace(/\s+/g, " ") : "";
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const radius = Number(body.radius);
  const bookingNotifications = body.bookingNotifications !== false;
  const messageNotifications = body.messageNotifications !== false;
  const theme = body.theme === "light" || body.theme === "dark" ? body.theme : "system";
  const timeZone = typeof body.timeZone === "string" ? body.timeZone.trim() : "auto";

  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (phone.length > 0 && phone.length !== 10) return NextResponse.json({ error: "Enter a 10-digit phone number or leave it blank." }, { status: 400 });
  if (city.length < 2 || city.length > 80 || !/^[A-Za-z .'-]+$/.test(city)) return NextResponse.json({ error: "Enter a valid city." }, { status: 400 });
  if (!/^[A-Z]{2}$/.test(state)) return NextResponse.json({ error: "Enter a two-letter state code." }, { status: 400 });
  if (!Number.isInteger(radius) || radius < 1 || radius > 250) return NextResponse.json({ error: "Enter a search radius from 1 to 250 miles." }, { status: 400 });
  if (timeZone !== "auto") {
    try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); }
    catch { return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 }); }
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query('UPDATE "user" SET name = $1, phone = $2, "updatedAt" = now() WHERE id = $3', [name, phone, session.user.id]);
    await client.query(
      `INSERT INTO user_settings (user_id, city, state, search_radius_miles, booking_notifications, message_notifications, theme, time_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         city = EXCLUDED.city, state = EXCLUDED.state,
         search_radius_miles = EXCLUDED.search_radius_miles,
         booking_notifications = EXCLUDED.booking_notifications,
         message_notifications = EXCLUDED.message_notifications,
         theme = EXCLUDED.theme, time_zone = EXCLUDED.time_zone`,
      [session.user.id, city, state, radius, bookingNotifications, messageNotifications, theme, timeZone],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Account settings update failed", error);
    return NextResponse.json({ error: "We could not save your settings." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, location: `${city}, ${state}`, radius, theme, timeZone });
}
