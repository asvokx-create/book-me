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
    service_id: string | null;
    price_cents: number | null;
    duration_minutes: number | null;
    image_urls: string[] | null;
  }>(
    `SELECT p.business_name, p.city, p.state,
            s.id::text AS service_id, s.title AS service_title, s.price_cents,
            s.duration_minutes, s.image_urls
     FROM provider_profiles p
     LEFT JOIN LATERAL (
       SELECT services.id, services.title, services.price_cents, services.duration_minutes,
              COALESCE((
                SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
                FROM service_images si WHERE si.service_id = services.id
              ), ARRAY[]::text[]) AS image_urls
       FROM services
       WHERE services.provider_id = p.id AND services.is_active = true
       ORDER BY services.created_at DESC
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
          id: provider.service_id,
          price: (provider.price_cents ?? 0) / 100,
          durationMinutes: provider.duration_minutes ?? 0,
          imageUrls: provider.image_urls ?? [],
        }
      : null,
  });
}
