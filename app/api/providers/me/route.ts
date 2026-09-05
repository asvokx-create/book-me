import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { hasAdminAccess } from "@/lib/admin";

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
    plan: "starter" | "pro" | "business";
    email_verified: boolean;
    phone_verified: boolean;
    identity_verified: boolean;
    business_verified: boolean;
    screening_status: "not_screened" | "passed" | "needs_changes";
    screening_score: number | null;
    screening_summary: string;
    screening_checked_at: Date | null;
    cancellation_window_hours: number;
    cancellation_policy: string;
    no_show_policy: string;
  }>(
    `SELECT p.id::text, p.business_name, p.city, p.state, p.plan,
            u."emailVerified" AS email_verified, p.phone_verified, p.identity_verified,
            p.business_verified, p.screening_status, p.screening_score, p.screening_summary,
            p.screening_checked_at, p.cancellation_window_hours, p.cancellation_policy, p.no_show_policy
     FROM provider_profiles p
     JOIN "user" u ON u.id = p.user_id
     WHERE p.user_id = $1`,
    [session.user.id],
  );

  if (!providerResult.rows[0]) {
    return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  }

  const provider = providerResult.rows[0];
  const isAdmin = await hasAdminAccess(session.user.id, session.user.email);
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
  const availabilityResult = await database.query<{
    weekday: number;
    start_time: string;
    end_time: string;
  }>(
    `SELECT weekday, start_time::text, end_time::text
     FROM availability
     WHERE provider_id::text = $1
     ORDER BY weekday, start_time`,
    [provider.id],
  );

  return NextResponse.json({
    name: session.user.name,
    businessName: provider.business_name,
    location: `${provider.city}, ${provider.state}`,
    plan: provider.plan,
    isAdmin,
    emailVerified: provider.email_verified,
    phoneVerified: provider.phone_verified,
    identityVerified: provider.identity_verified,
    businessVerified: provider.business_verified,
    screeningStatus: provider.screening_status,
    screeningScore: provider.screening_score,
    screeningSummary: provider.screening_summary,
    screeningCheckedAt: provider.screening_checked_at,
    cancellationWindowHours: provider.cancellation_window_hours,
    cancellationPolicy: provider.cancellation_policy,
    noShowPolicy: provider.no_show_policy,
    service: services[0] ?? null,
    services,
    availability: availabilityResult.rows.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.start_time,
      endTime: slot.end_time,
    })),
  });
}
