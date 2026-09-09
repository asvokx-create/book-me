import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getServiceAreaCoordinates } from "@/lib/service-areas";
import { checkAndRecordContent } from "@/lib/content-safety";

type LocationInput = { companyId?: unknown; locationId?: unknown; name?: unknown; location?: unknown; serviceRadiusMiles?: unknown; workerIds?: unknown };

function parseLocation(value: unknown) {
  const label = typeof value === "string" ? value.trim() : "";
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const state = parts.length > 1 ? parts.pop()! : "WA";
  const city = parts.join(", ") || label;
  const coordinates = getServiceAreaCoordinates(`${city}, ${state}`);
  return { label, city, state, coordinates };
}

async function ownerProvider() {
  const access = await getProviderAccess();
  if (!access || !access.isOwner) return null;
  const result = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE id::text = $1", [access.providerId]);
  return result.rows[0] ? { ...access, plan: result.rows[0].plan } : null;
}

export async function GET() {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider access not found." }, { status: 404 });
  const result = await database.query<{
    id: string; company_id: string; company_name: string; name: string; city: string; state: string;
    service_radius_miles: number; is_primary: boolean; listing_count: number; worker_ids: string[];
  }>(
    `SELECT location.id::text, company.id::text AS company_id, company.name AS company_name,
            location.name, location.city, location.state, location.service_radius_miles, location.is_primary,
            count(DISTINCT service.id) FILTER (WHERE service.is_active = true)::int AS listing_count,
            COALESCE(array_agg(DISTINCT assignment.team_member_id::text)
              FILTER (WHERE assignment.team_member_id IS NOT NULL), ARRAY[]::text[]) AS worker_ids
     FROM provider_locations location
     JOIN provider_companies company ON company.id = location.company_id AND company.is_active = true
     LEFT JOIN services service ON service.location_id = location.id
     LEFT JOIN provider_team_member_locations assignment ON assignment.location_id = location.id
     WHERE company.provider_id::text = $1 AND location.is_active = true
       AND ($2::uuid IS NULL OR assignment.team_member_id = $2::uuid)
     GROUP BY location.id, company.id
     ORDER BY company.created_at, location.is_primary DESC, location.created_at`,
    [access.providerId, access.memberId],
  );
  const members = access.isOwner ? await database.query<{ id: string; name: string; company_id: string }>(
    `SELECT id::text, name, company_id::text FROM provider_team_members
     WHERE provider_id::text = $1 AND status = 'active' ORDER BY name`, [access.providerId],
  ) : { rows: [] };
  const planResult = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE id::text = $1", [access.providerId]);
  return NextResponse.json({
    locations: result.rows.map((row) => ({ id: row.id, companyId: row.company_id, companyName: row.company_name, name: row.name, location: `${row.city}, ${row.state}`, serviceRadiusMiles: row.service_radius_miles, isPrimary: row.is_primary, listingCount: row.listing_count, workerIds: row.worker_ids })),
    members: members.rows.map((row) => ({ id: row.id, name: row.name, companyId: row.company_id })),
    isOwner: access.isOwner,
    plan: planResult.rows[0]?.plan ?? "starter",
  });
}

export async function POST(request: Request) {
  const provider = await ownerProvider();
  if (!provider) return NextResponse.json({ error: "Only the company owner can add locations." }, { status: 403 });
  const body = await request.json() as LocationInput;
  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const parsed = parseLocation(body.location);
  const radius = Number(body.serviceRadiusMiles);
  if (!companyId || name.length < 2 || name.length > 80 || !parsed.coordinates || !Number.isInteger(radius) || radius < 1 || radius > 250) {
    return NextResponse.json({ error: "Enter a location name, supported city, and service radius." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: provider.session.user.id, surface: "provider_location", fields: [name, parsed.label] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const count = await database.query<{ company_exists: boolean; count: number }>(
    `SELECT EXISTS(SELECT 1 FROM provider_companies WHERE provider_id::text = $1 AND id::text = $2 AND is_active = true) AS company_exists,
            (SELECT count(*)::int FROM provider_locations WHERE company_id::text = $2 AND is_active = true) AS count`, [provider.providerId, companyId],
  );
  if (!count.rows[0]?.company_exists) return NextResponse.json({ error: "Company page not found." }, { status: 404 });
  if (!PLAN_ENTITLEMENTS[provider.plan].multipleLocations) return NextResponse.json({ error: "Multiple locations require Pro.", upgradeRequired: true }, { status: 403 });
  try {
    const result = await database.query<{ id: string }>(
      `INSERT INTO provider_locations (company_id, name, city, state, latitude, longitude, service_radius_miles)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text`,
      [companyId, name, parsed.city, parsed.state, parsed.coordinates.latitude, parsed.coordinates.longitude, radius],
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "That company already has a location with this name." }, { status: 409 });
    console.error("Location creation failed", error);
    return NextResponse.json({ error: "We could not add that location." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const provider = await ownerProvider();
  if (!provider) return NextResponse.json({ error: "Only the company owner can manage locations." }, { status: 403 });
  const body = await request.json() as LocationInput;
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const parsed = parseLocation(body.location);
  const radius = Number(body.serviceRadiusMiles);
  const workerIds = Array.isArray(body.workerIds) ? body.workerIds.filter((id): id is string => typeof id === "string") : [];
  if (!locationId || name.length < 2 || name.length > 80 || !parsed.coordinates || !Number.isInteger(radius) || radius < 1 || radius > 250) {
    return NextResponse.json({ error: "Enter a location name, supported city, and service radius." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: provider.session.user.id, surface: "provider_location", fields: [name, parsed.label] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query<{ company_id: string }>(
      `SELECT location.company_id::text FROM provider_locations location JOIN provider_companies company ON company.id = location.company_id
       WHERE location.id::text = $1 AND company.provider_id::text = $2 AND location.is_active = true FOR UPDATE`, [locationId, provider.providerId],
    );
    if (!owned.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Location not found." }, { status: 404 }); }
    const validWorkers = await client.query<{ id: string }>(
      `SELECT id::text FROM provider_team_members WHERE provider_id::text = $1 AND company_id::text = $2 AND status = 'active' AND id::text = ANY($3::text[])`,
      [provider.providerId, owned.rows[0].company_id, workerIds],
    );
    await client.query(
      `UPDATE provider_locations SET name = $1, city = $2, state = $3, latitude = $4, longitude = $5, service_radius_miles = $6 WHERE id::text = $7`,
      [name, parsed.city, parsed.state, parsed.coordinates.latitude, parsed.coordinates.longitude, radius, locationId],
    );
    await client.query(
      `UPDATE services SET city = $1, state = $2, latitude = $3, longitude = $4, updated_at = now() WHERE location_id::text = $5`,
      [parsed.city, parsed.state, parsed.coordinates.latitude, parsed.coordinates.longitude, locationId],
    );
    await client.query("DELETE FROM provider_team_member_locations WHERE location_id::text = $1", [locationId]);
    for (const worker of validWorkers.rows) await client.query("INSERT INTO provider_team_member_locations (team_member_id, location_id) VALUES ($1, $2)", [worker.id, locationId]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "That company already has a location with this name." }, { status: 409 });
    console.error("Location update failed", error);
    return NextResponse.json({ error: "We could not update that location." }, { status: 500 });
  } finally { client.release(); }
}

export async function DELETE(request: Request) {
  const provider = await ownerProvider();
  if (!provider) return NextResponse.json({ error: "Only the company owner can remove locations." }, { status: 403 });
  const body = await request.json() as LocationInput;
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const result = await database.query<{ is_primary: boolean; listing_count: number }>(
    `SELECT location.is_primary, count(service.id) FILTER (WHERE service.is_active = true)::int AS listing_count
     FROM provider_locations location JOIN provider_companies company ON company.id = location.company_id
     LEFT JOIN services service ON service.location_id = location.id
     WHERE location.id::text = $1 AND company.provider_id::text = $2 AND location.is_active = true
     GROUP BY location.id`, [locationId, provider.providerId],
  );
  const location = result.rows[0];
  if (!location) return NextResponse.json({ error: "Location not found." }, { status: 404 });
  if (location.is_primary) return NextResponse.json({ error: "The primary location cannot be removed." }, { status: 409 });
  if (location.listing_count > 0) return NextResponse.json({ error: "Move or delete this location's active listings first." }, { status: 409 });
  await database.query("UPDATE provider_locations SET is_active = false, updated_at = now() WHERE id::text = $1", [locationId]);
  return NextResponse.json({ ok: true });
}
