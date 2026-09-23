import "server-only";

import { headers } from "next/headers";
import { findUsCity } from "@/lib/us-cities";
import { normalizeUsZipCode, resolveUsZipCode } from "@/lib/us-zip-codes";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function getContextualLocation(explicitLocation?: string) {
  if (explicitLocation?.trim()) {
    const requestedLocation = explicitLocation.trim();
    if (!normalizeUsZipCode(requestedLocation)) return requestedLocation;
    const city = await resolveUsZipCode(requestedLocation);
    return city ? `${city.city}, ${city.state}` : "";
  }

  const requestHeaders = await headers();
  try {
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (session?.user.id) {
      const result = await database.query<{ city: string | null; state: string | null }>(
        `SELECT location_city AS city, location_state AS state FROM "user" WHERE id = $1`,
        [session.user.id],
      );
      const accountLocation = result.rows[0];
      if (accountLocation?.city && accountLocation.state) return `${accountLocation.city}, ${accountLocation.state}`;
    }
  } catch (error) {
    console.error("Account location lookup failed", error);
  }
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
