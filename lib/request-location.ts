import "server-only";

import { headers } from "next/headers";
import { findUsCity } from "@/lib/us-cities";
import { normalizeUsZipCode, resolveUsZipCode } from "@/lib/us-zip-codes";

export async function getContextualLocation(explicitLocation?: string) {
  if (explicitLocation?.trim()) {
    const requestedLocation = explicitLocation.trim();
    if (!normalizeUsZipCode(requestedLocation)) return requestedLocation;
    const city = await resolveUsZipCode(requestedLocation);
    return city ? `${city.city}, ${city.state}` : "";
  }

  const requestHeaders = await headers();
  const encodedCity = requestHeaders.get("x-vercel-ip-city")?.trim();
  const region = requestHeaders.get("x-vercel-ip-country-region")?.trim();
  if (!encodedCity || !region) return "";

  try {
    const city = decodeURIComponent(encodedCity.replace(/\+/g, " "));
    const match = findUsCity(`${city}, ${region}`);
    return match ? `${match.city}, ${match.state}` : "";
  } catch {
    return "";
  }
}
