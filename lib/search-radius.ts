export const DEFAULT_SEARCH_RADIUS_MILES = 25;

// Half of Earth's circumference is about 12,450 miles, so a larger search
// radius cannot produce additional results. This keeps custom searches
// effectively unrestricted while still rejecting unreasonable input.
export const MAX_SEARCH_RADIUS_MILES = 12_500;

export function isValidSearchRadius(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_SEARCH_RADIUS_MILES;
}

export function normalizeSearchRadius(value: number, fallback = DEFAULT_SEARCH_RADIUS_MILES) {
  return isValidSearchRadius(value) ? value : fallback;
}
