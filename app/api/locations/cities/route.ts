import { NextResponse } from "next/server";
import { nearbyUsCities, searchUsCities } from "@/lib/us-cities";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const near = url.searchParams.get("near")?.trim() ?? "";
  const cities = near ? nearbyUsCities(near) : searchUsCities(query);
  return NextResponse.json(
    { cities: cities.map((city) => ({ city: city.city, state: city.state, latitude: city.latitude, longitude: city.longitude, ...("distance" in city && typeof city.distance === "number" ? { distance: city.distance } : {}), label: `${city.city}, ${city.state}` })) },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
