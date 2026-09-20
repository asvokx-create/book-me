import "server-only";

import { findUsCity, nearestUsCities, type UsCity } from "@/lib/us-cities";

type ZippopotamPlace = {
  "place name"?: string;
  "state abbreviation"?: string;
  latitude?: string;
  longitude?: string;
};

type ZippopotamResponse = {
  places?: ZippopotamPlace[];
};

export function normalizeUsZipCode(value: string) {
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] ?? "";
}

export async function resolveUsZipCode(value: string): Promise<UsCity | undefined> {
  const zipCode = normalizeUsZipCode(value);
  if (!zipCode) return undefined;

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
      next: { revalidate: 2_592_000 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return undefined;
    const data = await response.json() as ZippopotamResponse;
    const place = data.places?.[0];
    if (!place) return undefined;

    const namedCity = place["place name"] && place["state abbreviation"]
      ? findUsCity(`${place["place name"]}, ${place["state abbreviation"]}`)
      : undefined;
    if (namedCity) return namedCity;

    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? nearestUsCities(latitude, longitude, 1)[0]
      : undefined;
  } catch {
    return undefined;
  }
}
