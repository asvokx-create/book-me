import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { isAccountLocationSource, normalizeAccountLocation } from "@/lib/account-location";

type SettingsRow = {
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  location_source: string | null;
  location_updated_at: string | null;
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
            COALESCE(NULLIF(u.location_city, ''), NULLIF(us.city, ''), NULLIF(p.city, ''), '') AS city,
            COALESCE(NULLIF(u.location_state, ''), NULLIF(us.state, ''), NULLIF(p.state, ''), '') AS state,
            COALESCE(u.location_postal_code, '') AS postal_code,
            COALESCE(NULLIF(u.location_country, ''), 'United States') AS country,
            COALESCE(u.location_source, CASE WHEN COALESCE(NULLIF(us.city, ''), NULLIF(p.city, '')) IS NOT NULL THEN 'EXISTING_PROFILE' END) AS location_source,
            u.location_updated_at,
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
    postalCode: row.postal_code,
    country: row.country,
    locationSource: row.location_source,
    locationUpdatedAt: row.location_updated_at,
    locationComplete: Boolean(row.city && row.state && row.postal_code && row.country),
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
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "account-settings", limit: 20 })) return NextResponse.json({ error: "Too many settings changes. Please wait a minute." }, { status: 429 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const location = normalizeAccountLocation({ city: body.city, state: body.state, postalCode: body.postalCode, country: body.country });
  const radius = Number(body.radius);
  const bookingNotifications = body.bookingNotifications !== false;
  const messageNotifications = body.messageNotifications !== false;
  const theme = body.theme === "light" || body.theme === "dark" ? body.theme : "system";
  const timeZone = typeof body.timeZone === "string" ? body.timeZone.trim() : "auto";

  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (phone.length > 0 && phone.length !== 10) return NextResponse.json({ error: "Enter a 10-digit phone number or leave it blank." }, { status: 400 });
  if (!location.location) return NextResponse.json({ error: location.error ?? "Enter a valid account location." }, { status: 400 });
  if (!Number.isInteger(radius) || radius < 1 || radius > 250) return NextResponse.json({ error: "Enter a search radius from 1 to 250 miles." }, { status: 400 });
  if (timeZone !== "auto") {
    try { new Intl.DateTimeFormat("en-US", { timeZone }).format(); }
    catch { return NextResponse.json({ error: "Choose a valid time zone." }, { status: 400 }); }
  }

  const client = await database.connect();
  const requestedSource = typeof body.locationSource === "string" && isAccountLocationSource(body.locationSource) ? body.locationSource : "USER_ENTERED";
  const submittedSource = requestedSource === "BROWSER_LOCATION_CONFIRMED" ? requestedSource : "USER_ENTERED";
  let locationSource = submittedSource;
  try {
    await client.query("BEGIN");
    const currentResult = await client.query<{ city: string | null; state: string | null; postal_code: string | null; country: string | null; source: string | null }>(
      `SELECT location_city AS city, location_state AS state, location_postal_code AS postal_code,
              location_country AS country, location_source AS source
       FROM "user" WHERE id = $1 FOR UPDATE`,
      [session.user.id],
    );
    const current = currentResult.rows[0];
    const locationChanged = !current || current.city !== location.location.city || current.state !== location.location.state || current.postal_code !== location.location.postalCode || (current.country ?? "United States") !== location.location.country;
    if (!locationChanged && isAccountLocationSource(current?.source)) locationSource = current.source;
    await client.query(
      `UPDATE "user" SET name = $1, phone = $2, location_city = $3, location_state = $4,
       location_postal_code = $5, location_country = $6, location_source = $7,
       location_updated_at = CASE WHEN $9::boolean OR location_updated_at IS NULL THEN now() ELSE location_updated_at END,
       "updatedAt" = now() WHERE id = $8`,
      [name, phone, location.location.city, location.location.state, location.location.postalCode, location.location.country, locationSource, session.user.id, locationChanged],
    );
    await client.query(
      `INSERT INTO user_settings (user_id, city, state, search_radius_miles, booking_notifications, message_notifications, theme, time_zone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         city = EXCLUDED.city, state = EXCLUDED.state,
         search_radius_miles = EXCLUDED.search_radius_miles,
         booking_notifications = EXCLUDED.booking_notifications,
         message_notifications = EXCLUDED.message_notifications,
         theme = EXCLUDED.theme, time_zone = EXCLUDED.time_zone`,
      [session.user.id, location.location.city, location.location.state, radius, bookingNotifications, messageNotifications, theme, timeZone],
    );
    if (locationChanged) {
      await client.query(
        `INSERT INTO activity_log (user_id, action, target_type, target_id, metadata)
         VALUES ($1, 'account_location_updated', 'account', $1, $2::jsonb)`,
        [session.user.id, JSON.stringify({ source: locationSource })],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Account settings update failed", error);
    return NextResponse.json({ error: "We could not save your settings." }, { status: 500 });
  } finally {
    client.release();
  }

  return NextResponse.json({ ok: true, location: `${location.location.city}, ${location.location.state}`, postalCode: location.location.postalCode, country: location.location.country, locationSource, radius, theme, timeZone });
}
