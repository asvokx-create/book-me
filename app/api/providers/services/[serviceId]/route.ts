import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { checkAndRecordContent } from "@/lib/content-safety";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { checkAndRecordListingFinancialCrimeRisk } from "@/lib/financial-crime-screening";

const allowedDurations = new Set([60, 120, 180, 240, 480]);

async function getSessionUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { serviceId } = await params;
  const result = await database.query<{
    id: string;
    business_name: string;
    slug: string;
    title: string;
    category: string;
    description: string;
    price_cents: number;
    duration_minutes: number;
    city: string;
    state: string;
    booking_questions: string[];
    plan: ProviderPlan;
    location_id: string;
    location_name: string;
    locations: Array<{ id: string; name: string; location: string }>;
  }>(
    `SELECT s.id::text, s.business_name, s.slug, s.title, s.category, s.description,
            s.price_cents, s.duration_minutes, COALESCE(s.city, p.city) AS city, COALESCE(s.state, p.state) AS state,
            s.booking_questions, p.plan, location.id::text AS location_id, location.name AS location_name,
            (SELECT jsonb_agg(jsonb_build_object('id', choice.id::text, 'name', choice.name, 'location', choice.city || ', ' || choice.state)
              ORDER BY choice.is_primary DESC, choice.created_at)
             FROM provider_locations choice WHERE choice.company_id = s.company_id AND choice.is_active = true) AS locations
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     JOIN provider_locations location ON location.id = s.location_id
     WHERE s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
     LIMIT 1`,
    [serviceId, userId],
  );

  const service = result.rows[0];
  if (!service) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({
    id: service.id,
    businessName: service.business_name,
    slug: service.slug,
    title: service.title,
    category: service.category,
    description: service.description,
    price: service.price_cents / 100,
    durationMinutes: service.duration_minutes,
    location: `${service.city}, ${service.state}`,
    locationId: service.location_id,
    locationName: service.location_name,
    locations: service.locations ?? [],
    bookingQuestions: service.booking_questions ?? [],
    customQuestionsAllowed: PLAN_ENTITLEMENTS[service.plan].customBookingQuestions,
    multipleLocationsAllowed: PLAN_ENTITLEMENTS[service.plan].multipleLocations,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { serviceId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const businessName = typeof body.businessName === "string" ? body.businessName.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const locationId = typeof body.locationId === "string" ? body.locationId.trim() : "";
  const price = Number(body.price);
  const durationMinutes = Number(body.durationMinutes);
  const bookingQuestions = Array.isArray(body.bookingQuestions) ? body.bookingQuestions.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean) : [];

  if (!businessName || businessName.length > 120 || !title || title.length > 120 || !SERVICE_CATEGORIES.includes(category as (typeof SERVICE_CATEGORIES)[number]) || description.length < 10 || description.length > 2000 || !locationId || !Number.isFinite(price) || price <= 0 || price > 1_000_000 || !allowedDurations.has(durationMinutes) || bookingQuestions.length > 3 || bookingQuestions.some((question) => question.length > 180)) {
    return NextResponse.json({ error: "Complete every field with valid listing details." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId, surface: "provider_listing", fields: [businessName, title, description] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const financialRisk = await checkAndRecordListingFinancialCrimeRisk({
    userId,
    surface: "provider_listing_financial_risk",
    input: { businessName, title, category, description, priceCents: Math.round(price * 100) },
  });
  if (!financialRisk.allowed) {
    return NextResponse.json({ error: financialRisk.message, financialRisk: { level: financialRisk.level, score: financialRisk.score } }, { status: 422 });
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const ownership = await client.query<{ provider_id: string; plan: ProviderPlan; business_name: string; company_id: string; current_location_id: string }>(
      `SELECT s.provider_id::text, p.plan, company.name AS business_name, company.id::text AS company_id, s.location_id::text AS current_location_id
       FROM services s JOIN provider_profiles p ON p.id = s.provider_id
       JOIN provider_companies company ON company.id = s.company_id
       WHERE s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
       FOR UPDATE`,
      [serviceId, userId],
    );
    if (!ownership.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    if (ownership.rows[0].business_name !== businessName) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A listing cannot be moved between company pages. Create a new listing under the correct company." }, { status: 400 });
    }
    const entitlements = PLAN_ENTITLEMENTS[ownership.rows[0].plan];
    if (bookingQuestions.length && !entitlements.customBookingQuestions) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Custom booking questions require Pro.", upgradeRequired: true }, { status: 403 });
    }
    if (!entitlements.multipleLocations && locationId !== ownership.rows[0].current_location_id) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Multiple locations require Pro.", upgradeRequired: true }, { status: 403 });
    }
    const selectedLocation = await client.query<{ city: string; state: string; latitude: number; longitude: number }>(
      `SELECT city, state, latitude, longitude FROM provider_locations
       WHERE id::text = $1 AND company_id::text = $2 AND is_active = true`,
      [locationId, ownership.rows[0].company_id],
    );
    if (!selectedLocation.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Choose an active location from this company." }, { status: 400 });
    }
    const selected = selectedLocation.rows[0];

    await client.query(
      `UPDATE services
       SET business_name = $1, title = $2, category = $3, description = $4,
           price_cents = $5, duration_minutes = $6, booking_questions = $7::jsonb,
           location_id = $8, city = $9, state = $10, latitude = $11, longitude = $12
       WHERE id::text = $13`,
      [businessName, title, category, description, Math.round(price * 100), durationMinutes, JSON.stringify(bookingQuestions), locationId, selected.city, selected.state, selected.latitude, selected.longitude, serviceId],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Listing update failed", error);
    return NextResponse.json({ error: "We could not update this listing. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { serviceId } = await params;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ provider_id: string; company_id: string; business_name: string }>(
      `SELECT s.provider_id::text, s.company_id::text, s.business_name
       FROM services s JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
       FOR UPDATE OF s, p`,
      [serviceId, userId],
    );
    const removed = result.rows[0];
    if (!removed) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    await client.query("UPDATE services SET is_active = false, updated_at = now() WHERE id::text = $1", [serviceId]);
    await client.query(
      `UPDATE provider_team_members member
       SET status = 'inactive', updated_at = now()
       WHERE member.provider_id::text = $1 AND member.company_id::text = $2 AND member.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM services remaining
             WHERE remaining.provider_id = member.provider_id
               AND remaining.company_id = member.company_id
             AND remaining.is_active = true
         )`,
      [removed.provider_id, removed.company_id],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Listing removal failed", error);
    return NextResponse.json({ error: "We could not remove this listing. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
