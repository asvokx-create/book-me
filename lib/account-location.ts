export const ACCOUNT_LOCATION_SOURCES = [
  "USER_ENTERED",
  "BROWSER_LOCATION_CONFIRMED",
  "EXISTING_PROFILE",
  "ADMIN_UPDATED",
] as const;

export type AccountLocationSource = typeof ACCOUNT_LOCATION_SOURCES[number];

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
]);

export type AccountLocationInput = {
  city: unknown;
  state: unknown;
  postalCode: unknown;
  country?: unknown;
};

export type NormalizedAccountLocation = {
  city: string;
  state: string;
  postalCode: string;
  country: "United States";
};

export function normalizeAccountLocation(input: AccountLocationInput): { location?: NormalizedAccountLocation; error?: string } {
  const city = typeof input.city === "string" ? input.city.trim().replace(/\s+/g, " ") : "";
  const state = typeof input.state === "string" ? input.state.trim().toUpperCase() : "";
  const postalInput = typeof input.postalCode === "string" ? input.postalCode.trim() : "";
  const countryInput = typeof input.country === "string" ? input.country.trim().toLowerCase() : "united states";
  const postalMatch = postalInput.match(/^(\d{5})(?:[-\s]?(\d{4}))?$/);

  if (city.length < 2 || city.length > 80 || !/^[A-Za-zÀ-ÖØ-öø-ÿ .'-]+$/.test(city)) return { error: "Enter a valid city." };
  if (!US_STATE_CODES.has(state)) return { error: "Choose a valid U.S. state or district." };
  if (!postalMatch) return { error: "Enter a valid 5-digit ZIP code or ZIP+4." };
  if (!["us", "usa", "united states", "united states of america"].includes(countryInput)) return { error: "BubsBookings currently supports account locations in the United States." };

  return {
    location: {
      city,
      state,
      postalCode: postalMatch[2] ? `${postalMatch[1]}-${postalMatch[2]}` : postalMatch[1],
      country: "United States",
    },
  };
}

export function isAccountLocationSource(value: unknown): value is AccountLocationSource {
  return typeof value === "string" && ACCOUNT_LOCATION_SOURCES.includes(value as AccountLocationSource);
}

export function accountLocationSourceLabel(source: string | null | undefined) {
  switch (source) {
    case "USER_ENTERED": return "User entered";
    case "BROWSER_LOCATION_CONFIRMED": return "Browser location confirmed";
    case "EXISTING_PROFILE": return "Existing profile";
    case "ADMIN_UPDATED": return "Admin updated";
    default: return "Not provided";
  }
}
