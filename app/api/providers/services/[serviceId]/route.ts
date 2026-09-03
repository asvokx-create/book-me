import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

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
    slug: string;
    title: string;
    category: string;
    description: string;
    price_cents: number;
    duration_minutes: number;
    city: string;
    state: string;
  }>(
    `SELECT s.id::text, s.slug, s.title, s.category, s.description,
            s.price_cents, s.duration_minutes, p.city, p.state
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
    slug: service.slug,
    title: service.title,
    category: service.category,
    description: service.description,
    price: service.price_cents / 100,
    durationMinutes: service.duration_minutes,
    location: `${service.city}, ${service.state}`,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { serviceId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const price = Number(body.price);
  const durationMinutes = Number(body.durationMinutes);

  if (!title || title.length > 120 || !SERVICE_CATEGORIES.includes(category as (typeof SERVICE_CATEGORIES)[number]) || description.length < 10 || description.length > 2000 || !location || location.length > 120 || !Number.isFinite(price) || price <= 0 || price > 1_000_000 || !allowedDurations.has(durationMinutes)) {
    return NextResponse.json({ error: "Complete every field with valid listing details." }, { status: 400 });
  }

  const locationParts = location.split(",").map((part) => part.trim()).filter(Boolean);
  const state = locationParts.length > 1 ? locationParts.pop()! : "WA";
  const city = locationParts.join(", ") || location;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const ownership = await client.query<{ provider_id: string }>(
      `SELECT s.provider_id::text
       FROM services s JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1 AND p.user_id = $2 AND s.is_active = true
       FOR UPDATE`,
      [serviceId, userId],
    );
    if (!ownership.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Listing not found." }, { status: 404 });
    }

    await client.query(
      `UPDATE services
       SET title = $1, category = $2, description = $3,
           price_cents = $4, duration_minutes = $5
       WHERE id::text = $6`,
      [title, category, description, Math.round(price * 100), durationMinutes, serviceId],
    );
    await client.query(
      `UPDATE provider_profiles SET city = $1, state = $2 WHERE id::text = $3`,
      [city, state, ownership.rows[0].provider_id],
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
