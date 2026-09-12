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

const SERVICE_SEARCH_ALIASES: Partial<Record<(typeof SERVICE_CATEGORIES)[number], readonly string[]>> = {
  "Home cleaning": ["house cleaning", "home cleaner", "house cleaner", "maid", "maid service", "housekeeping", "deep cleaning", "move out cleaning"],
  "Car detailing": ["auto detailing", "vehicle detailing", "car cleaning", "mobile detailing", "car wash"],
  "Lawn & garden": ["yard care", "lawn care", "yard work", "mowing", "lawn mowing", "grass cutting", "landscaping", "gardening", "gardener", "weed removal"],
  Handyman: ["handy man", "odd jobs", "small repairs", "home maintenance"],
  Photography: ["photographer", "photos", "photo shoot", "portraits"],
  Videography: ["videographer", "video production", "video shoot"],
  "Pressure washing": ["power washing", "exterior cleaning", "driveway cleaning"],
  "Furniture assembly": ["furniture building", "ikea assembly", "desk assembly", "bed assembly"],
  "House painting": ["house painter", "painter", "interior painting", "exterior painting"],
  "Pet care": ["dog walking", "dog walker", "pet sitting", "pet sitter", "dog sitting", "cat sitting"],
  "Moving help": ["movers", "moving", "packing help", "loading help", "unloading help"],
  "Junk removal": ["junk hauling", "hauling", "trash removal", "rubbish removal", "dump run"],
  "Personal training": ["personal trainer", "fitness coach", "workout coach"],
  "Beauty & wellness": ["makeup artist", "hair stylist", "massage", "esthetician", "beauty services"],
  Tutoring: ["tutor", "homework help", "academic help", "private lessons"],
  "Tech help": ["computer help", "computer repair", "it help", "device setup", "tech support"],
  "Event services": ["event planner", "party planning", "party help", "event setup"],
  "Home repair": ["house repair", "household repairs", "property maintenance"],
  "Appliance repair": ["appliance technician", "washer repair", "dryer repair", "refrigerator repair"],
  Plumbing: ["plumber", "pipe repair", "drain repair", "faucet repair", "toilet repair"],
  Electrical: ["electrician", "electrical repair", "wiring", "outlet repair", "light installation"],
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function editDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function getServiceCategorySearchMatches(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return [];

  return SERVICE_CATEGORIES.filter((category) => {
    const searchTerms = [category, ...(SERVICE_SEARCH_ALIASES[category] ?? [])].map(normalizeSearchText);
    const compactQuery = normalizedQuery.replaceAll(" ", "");
    return searchTerms.some((term) => {
      const compactTerm = term.replaceAll(" ", "");
      return normalizedQuery.includes(term)
        || term.startsWith(normalizedQuery)
        || compactTerm === compactQuery
        || (compactQuery.length >= 5 && editDistance(compactQuery, compactTerm) <= 2);
    });
  });
}

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
