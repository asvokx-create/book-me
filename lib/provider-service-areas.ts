import "server-only";

import { findUsCity } from "@/lib/us-cities";
import { normalizeUsZipCode, resolveUsZipCode } from "@/lib/us-zip-codes";

export type NormalizedProviderServiceArea = {
  areaType: "city" | "zip";
  normalizedValue: string;
  label: string;
  city: string;
  state: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
};

export async function normalizeProviderServiceAreas(values: unknown): Promise<NormalizedProviderServiceArea[]> {
  if (!Array.isArray(values)) return [];
  const requested = Array.from(new Set(values.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))).slice(0, 25);
  const normalized: NormalizedProviderServiceArea[] = [];

  for (const value of requested) {
    const postalCode = normalizeUsZipCode(value);
    const place = postalCode ? await resolveUsZipCode(postalCode) : findUsCity(value);
    if (!place) throw new Error(`We could not find the service area “${value}”. Use a U.S. ZIP code or City, ST.`);
    normalized.push({
      areaType: postalCode ? "zip" : "city",
      normalizedValue: postalCode || `${place.city}, ${place.state}`.toLowerCase(),
      label: postalCode ? `${postalCode} · ${place.city}, ${place.state}` : `${place.city}, ${place.state}`,
      city: place.city,
      state: place.state,
      postalCode: postalCode || null,
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }

  return normalized;
}

export async function replaceProviderServiceAreas(client: { query: (text: string, values?: unknown[]) => Promise<unknown> }, locationId: string, areas: NormalizedProviderServiceArea[]) {
  await client.query("DELETE FROM provider_location_service_areas WHERE location_id::text = $1", [locationId]);
  for (const area of areas) {
    await client.query(
      `INSERT INTO provider_location_service_areas
        (location_id, area_type, normalized_value, city, state, postal_code, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [locationId, area.areaType, area.normalizedValue, area.city, area.state, area.postalCode, area.latitude, area.longitude],
    );
  }
}
