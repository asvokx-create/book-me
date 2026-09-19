import "server-only";

import { headers } from "next/headers";
import { findUsCity } from "@/lib/us-cities";

const FALLBACK_LOCATION = "Seattle, WA";

export async function getContextualLocation(explicitLocation?: string) {
  if (explicitLocation?.trim()) return explicitLocation.trim();

  const requestHeaders = await headers();
  const encodedCity = requestHeaders.get("x-vercel-ip-city")?.trim();
  const region = requestHeaders.get("x-vercel-ip-country-region")?.trim();
  if (!encodedCity || !region) return FALLBACK_LOCATION;

  try {
    const city = decodeURIComponent(encodedCity.replace(/\+/g, " "));
    const match = findUsCity(`${city}, ${region}`);
    return match ? `${match.city}, ${match.state}` : FALLBACK_LOCATION;
  } catch {
    return FALLBACK_LOCATION;
  }
}
