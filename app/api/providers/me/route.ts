import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const result = await database.query<{
    business_name: string;
    city: string;
    state: string;
    service_title: string | null;
    price_cents: number | null;
    duration_minutes: number | null;
  }>(
    `SELECT p.business_name, p.city, p.state,
            s.title AS service_title, s.price_cents, s.duration_minutes
     FROM provider_profiles p
     LEFT JOIN LATERAL (
       SELECT title, price_cents, duration_minutes
       FROM services
       WHERE provider_id = p.id AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1
     ) s ON true
     WHERE p.user_id = $1`,
    [session.user.id],
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  }

  const provider = result.rows[0];
  return NextResponse.json({
    name: session.user.name,
    businessName: provider.business_name,
    location: `${provider.city}, ${provider.state}`,
    service: provider.service_title
      ? {
          title: provider.service_title,
          price: (provider.price_cents ?? 0) / 100,
          durationMinutes: provider.duration_minutes ?? 0,
        }
      : null,
  });
}
