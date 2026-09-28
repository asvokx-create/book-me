export const PUBLIC_SITE_ORIGIN = "https://bubsbookings.com";

export type ListingShareMethod = "opened" | "native" | "copy_link" | "facebook" | "x" | "whatsapp" | "linkedin" | "email";

export function canonicalListingUrl(slug: string) {
  const safeSlug = encodeURIComponent(slug.trim());
  return new URL(`/services/${safeSlug}`, PUBLIC_SITE_ORIGIN).toString();
}

export function listingShareText(title: string) {
  return `Check out ${title} on BubsBookings.`;
}

export function listingShareDestinations(title: string, slug: string) {
  const url = canonicalListingUrl(slug);
  const text = listingShareText(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(`${title} on BubsBookings`)}&body=${encodeURIComponent(`Check out this service on BubsBookings:\n\n${url}`)}`,
  };
}

