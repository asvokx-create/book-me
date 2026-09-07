export const SERVICE_CATEGORIES = [
  "Home cleaning",
  "Car detailing",
  "Lawn & garden",
  "Handyman",
  "Photography",
  "Videography",
  "Pressure washing",
  "Furniture assembly",
  "House painting",
  "Pet care",
  "Moving help",
  "Junk removal",
  "Personal training",
  "Beauty & wellness",
  "Tutoring",
  "Tech help",
  "Event services",
  "Home repair",
  "Appliance repair",
  "Plumbing",
  "Electrical",
] as const;

export const FEATURED_SERVICE_CATEGORIES = SERVICE_CATEGORIES.slice(0, 5);

export function serviceCategorySlug(category: string) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function getServiceCategoryBySlug(slug: string) {
  return SERVICE_CATEGORIES.find((category) => serviceCategorySlug(category) === slug.toLowerCase());
}

export const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  "Home cleaning": "🧽",
  "Pressure washing": "💦",
  "Car detailing": "🚗",
  "Lawn & garden": "🌿",
  Handyman: "🔨",
  "Furniture assembly": "🪑",
  "House painting": "🖌️",
  Photography: "📷",
  Videography: "🎥",
  "Pet care": "🐾",
  "Moving help": "📦",
  "Junk removal": "🗑️",
  "Personal training": "🏋️",
  "Beauty & wellness": "✨",
  Tutoring: "📚",
  "Tech help": "💻",
  "Event services": "🎉",
  "Home repair": "🏠",
  "Appliance repair": "🔧",
  Plumbing: "🚿",
  Electrical: "⚡",
};
