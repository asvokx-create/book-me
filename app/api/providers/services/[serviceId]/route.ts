import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { checkAndRecordContent } from "@/lib/content-safety";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getServiceAreaCoordinates } from "@/lib/service-areas";

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
  }>(
    `SELECT s.id::text, s.business_name, s.slug, s.title, s.category, s.description,
            s.price_cents, s.duration_minutes, COALESCE(s.city, p.city) AS city, COALESCE(s.state, p.state) AS state,
            s.booking_questions, p.plan
     FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
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
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const price = Number(body.price);
  const durationMinutes = Number(body.durationMinutes);
  const bookingQuestions = Array.isArray(body.bookingQuestions) ? body.bookingQuestions.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean) : [];

  if (!businessName || businessName.length > 120 || !title || title.length > 120 || !SERVICE_CATEGORIES.includes(category as (typeof SERVICE_CATEGORIES)[number]) || description.length < 10 || description.length > 2000 || !location || location.length > 120 || !Number.isFinite(price) || price <= 0 || price > 1_000_000 || !allowedDurations.has(durationMinutes) || bookingQuestions.length > 3 || bookingQuestions.some((question) => question.length > 180)) {
    return NextResponse.json({ error: "Complete every field with valid listing details." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId, surface: "provider_listing", fields: [businessName, title, description, location] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });

  const locationParts = location.split(",").map((part) => part.trim()).filter(Boolean);
  const state = locationParts.length > 1 ? locationParts.pop()! : "WA";
  const city = locationParts.join(", ") || location;
  const coordinates = getServiceAreaCoordinates(`${city}, ${state}`);
  if (!coordinates) return NextResponse.json({ error: "Choose a supported city and state for this listing." }, { status: 400 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const ownership = await client.query<{ provider_id: string; plan: ProviderPlan }>(
      `SELECT s.provider_id::text, p.plan
       FROM services s JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
       FOR UPDATE`,
      [serviceId, userId],
    );
    if (!ownership.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }
    const entitlements = PLAN_ENTITLEMENTS[ownership.rows[0].plan];
    if (bookingQuestions.length && !entitlements.customBookingQuestions) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Custom booking questions require Pro or Business.", upgradeRequired: true }, { status: 403 });
    }

    await client.query(
      `UPDATE services
       SET business_name = $1, title = $2, category = $3, description = $4,
           price_cents = $5, duration_minutes = $6, booking_questions = $7::jsonb,
           city = $8, state = $9, latitude = $10, longitude = $11
       WHERE id::text = $12`,
      [businessName, title, category, description, Math.round(price * 100), durationMinutes, JSON.stringify(bookingQuestions), city, state, coordinates.latitude, coordinates.longitude, serviceId],
    );
    if (!entitlements.multipleLocations) {
      await client.query(`UPDATE provider_profiles SET city = $1, state = $2, latitude = $3, longitude = $4 WHERE id::text = $5`, [city, state, coordinates.latitude, coordinates.longitude, ownership.rows[0].provider_id]);
      await client.query(`UPDATE services SET city = $1, state = $2, latitude = $3, longitude = $4 WHERE provider_id::text = $5 AND is_active = true`, [city, state, coordinates.latitude, coordinates.longitude, ownership.rows[0].provider_id]);
    }
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
  const result = await database.query(
    `UPDATE services s
     SET is_active = false
     FROM provider_profiles p
     WHERE s.provider_id = p.id AND s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
     RETURNING s.id`,
    [serviceId, userId],
  );
  if (result.rowCount === 0) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
