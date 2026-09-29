export const PROVIDER_LANGUAGES = [
  "American Sign Language", "Arabic", "Chinese", "English", "French", "German",
  "Hindi", "Italian", "Japanese", "Korean", "Portuguese", "Russian", "Spanish", "Tagalog", "Vietnamese",
] as const;

export const PROVIDER_HIGHLIGHTS = [
  "Commercial experience", "Eco-friendly options", "Family-owned business",
  "Flexible scheduling", "Residential experience", "Weekend availability",
] as const;

export const PROVIDER_PROFILE_LIMITS = {
  about: 1200,
  experience: 1200,
  specialty: 50,
  specialties: 8,
  languages: 8,
  highlights: 6,
  portfolio: 12,
  caption: 160,
  altText: 160,
} as const;

export function slugifyProviderName(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "provider";
}
