import { NextResponse } from "next/server";
import { nearbyUsCities, nearestUsCities, searchUsCities } from "@/lib/us-cities";
import { normalizeUsZipCode, resolveUsZipCode } from "@/lib/us-zip-codes";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const near = url.searchParams.get("near")?.trim() ?? "";
  const latitudeParam = url.searchParams.get("lat");
  const longitudeParam = url.searchParams.get("lng");
  const latitude = latitudeParam === null || latitudeParam.trim() === "" ? Number.NaN : Number(latitudeParam);
  const longitude = longitudeParam === null || longitudeParam.trim() === "" ? Number.NaN : Number(longitudeParam);
  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 30) : 12;
  const zipCode = normalizeUsZipCode(near || query);
  const zipCity = zipCode ? await resolveUsZipCode(zipCode) : undefined;
  const resolvedLocation = zipCity ? `${zipCity.city}, ${zipCity.state}` : undefined;
  const cities = zipCity
    ? [zipCity, ...nearbyUsCities(resolvedLocation!, limit)].slice(0, limit)
    : Number.isFinite(latitude) && Number.isFinite(longitude)
      ? nearestUsCities(latitude, longitude, limit)
      : near ? nearbyUsCities(near, limit) : searchUsCities(query, limit);
  return NextResponse.json(
    { resolvedLocation, cities: cities.map((city) => ({ city: city.city, state: city.state, latitude: city.latitude, longitude: city.longitude, ...("distance" in city && typeof city.distance === "number" ? { distance: city.distance } : {}), label: `${city.city}, ${city.state}` })) },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
