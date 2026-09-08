import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{ id: string; name: string; slug: string; city: string; state: string; service_radius_miles: number; listing_count: number }>(
    `SELECT company.id::text, company.name, company.slug, company.city, company.state, company.service_radius_miles,
            count(service.id) FILTER (WHERE service.is_active = true)::int AS listing_count
     FROM provider_companies company
     JOIN provider_profiles provider ON provider.id = company.provider_id
     LEFT JOIN services service ON service.company_id = company.id
     WHERE provider.user_id = $1 AND company.is_active = true
     GROUP BY company.id
     ORDER BY company.created_at`,
    [session.user.id],
  );
  return NextResponse.json({
    companies: result.rows.map((company) => ({ id: company.id, name: company.name, slug: company.slug, location: `${company.city}, ${company.state}`, serviceRadiusMiles: company.service_radius_miles, listingCount: company.listing_count })),
  });
}
