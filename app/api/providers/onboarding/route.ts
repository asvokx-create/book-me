import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { hasAdminAccess } from "@/lib/admin";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

const durationMinutes: Record<string, number> = {
  "1 hour": 60,
  "2 hours": 120,
  "3 hours": 180,
  "Half day": 240,
  "Full day": 480,
};

const weekdayNumbers: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 54);
  return `${base || "service"}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Log in before creating a provider profile." }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const business = typeof body.business === "string" ? body.business.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const serviceArea = typeof body.city === "string" ? body.city.trim() : "";
  const service = typeof body.service === "string" ? body.service.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const duration = typeof body.duration === "string" ? body.duration : "";
  const price = Number(body.price);
  const requestedPlan = body.plan === "pro" || body.plan === "business" ? body.plan : "starter";
  const selectedDays = Array.isArray(body.selectedDays)
    ? body.selectedDays.filter((day): day is string => typeof day === "string" && day in weekdayNumbers)
    : [];
  const startTime = typeof body.startTime === "string" ? body.startTime : "09:00";
  const endTime = typeof body.endTime === "string" ? body.endTime : "17:00";
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!business || !category || !serviceArea || !service || !description || !Number.isFinite(price) || price <= 0 || !durationMinutes[duration] || selectedDays.length === 0 || !validTime.test(startTime) || !validTime.test(endTime) || startTime >= endTime) {
    return NextResponse.json({ error: "Complete all provider, service, and availability fields." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "provider_listing", fields: [business, service, description, serviceArea] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const existingProfile = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE user_id = $1", [session.user.id]);
  const plan: ProviderPlan = await hasAdminAccess(session.user.id, session.user.email)
    ? "business"
    : existingProfile.rows[0]?.plan ?? requestedPlan;

  const locationParts = serviceArea.split(",").map((part) => part.trim()).filter(Boolean);
  const state = locationParts.length > 1 ? locationParts.pop()! : "WA";
  const city = locationParts.join(", ") || serviceArea;
  const client = await database.connect();

  try {
    await client.query("BEGIN");
    await client.query('UPDATE "user" SET role = $1, "updatedAt" = now() WHERE id = $2', ["provider", session.user.id]);

    const profileResult = await client.query<{ id: string }>(
      `INSERT INTO provider_profiles (user_id, business_name, bio, phone, city, state, plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         business_name = EXCLUDED.business_name,
         bio = EXCLUDED.bio,
         phone = EXCLUDED.phone,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         plan = EXCLUDED.plan
       RETURNING id`,
      [session.user.id, business, description, session.user.phone ?? null, city, state, plan],
    );
    const providerId = profileResult.rows[0].id;

    const serviceLimit = PLAN_ENTITLEMENTS[plan].serviceLimit;
    if (serviceLimit !== null) {
      const serviceCount = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM services WHERE provider_id = $1 AND is_active = true", [providerId]);
      if (serviceCount.rows[0].count >= serviceLimit) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: `Your ${PLAN_ENTITLEMENTS[plan].name} plan allows up to ${serviceLimit} active services. Upgrade from Billing to add more.`, upgradeRequired: true }, { status: 403 });
      }
    }

    const serviceResult = await client.query<{ id: string }>(
      `INSERT INTO services (provider_id, slug, category, title, description, price_cents, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id::text`,
      [providerId, slugify(service), category, service, description, Math.round(price * 100), durationMinutes[duration]],
    );

    await client.query("DELETE FROM availability WHERE provider_id = $1", [providerId]);
    for (const day of selectedDays) {
      await client.query(
        `INSERT INTO availability (provider_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [providerId, weekdayNumbers[day], startTime, endTime],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, serviceId: serviceResult.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Provider onboarding failed", error);
    return NextResponse.json({ error: "We could not save your provider profile. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
