export const SERVICE_CATEGORIES = [
  "Home cleaning",
  "Car detailing",
  "Lawn & garden",
  "Handyman",
  "Photography",
  "Videography",
  "Pet care",
  "Moving help",
  "Personal training",
  "Beauty & wellness",
  "Tutoring",
  "Event services",
  "Home repair",
  "Appliance repair",
  "Plumbing",
  "Electrical",
] as const;

export const FEATURED_SERVICE_CATEGORIES = SERVICE_CATEGORIES.slice(0, 5);

export const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  "Home cleaning": "🧽",
  "Car detailing": "🚗",
  "Lawn & garden": "🌿",
  Handyman: "🔨",
  Photography: "📷",
  Videography: "🎥",
  "Pet care": "🐾",
  "Moving help": "📦",
  "Personal training": "🏋️",
  "Beauty & wellness": "✨",
  Tutoring: "📚",
  "Event services": "🎉",
  "Home repair": "🏠",
  "Appliance repair": "🔧",
  Plumbing: "🚿",
  Electrical: "⚡",
};
