import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const providerResult = await database.query<{
    id: string;
    business_name: string;
    city: string;
    state: string;
  }>(
    `SELECT p.id::text, p.business_name, p.city, p.state
     FROM provider_profiles p
     WHERE p.user_id = $1`,
    [session.user.id],
  );

  if (!providerResult.rows[0]) {
    return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  }

  const provider = providerResult.rows[0];
  const serviceResult = await database.query<{
    id: string;
    slug: string;
    title: string;
    category: string;
    price_cents: number;
    duration_minutes: number;
    image_urls: string[] | null;
  }>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.price_cents, s.duration_minutes,
            COALESCE((
              SELECT array_agg(si.public_url ORDER BY si.sort_order, si.created_at)
              FROM service_images si WHERE si.service_id = s.id
            ), ARRAY[]::text[]) AS image_urls
     FROM services s
     WHERE s.provider_id::text = $1 AND s.is_active = true
     ORDER BY s.created_at DESC`,
    [provider.id],
  );
  const services = serviceResult.rows.map((service) => ({
    id: service.id,
    slug: service.slug,
    title: service.title,
    category: service.category,
    price: service.price_cents / 100,
    durationMinutes: service.duration_minutes,
    imageUrls: service.image_urls ?? [],
  }));

  return NextResponse.json({
    name: session.user.name,
    businessName: provider.business_name,
    location: `${provider.city}, ${provider.state}`,
    service: services[0] ?? null,
    services,
  });
}
