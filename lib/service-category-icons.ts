import { SERVICE_CATEGORIES } from "./service-categories";

export type ServiceCategoryIconName =
  | "cleaning" | "car" | "garden" | "handyman" | "camera" | "video" | "pressure-washing"
  | "furniture" | "painting" | "pet" | "moving" | "junk" | "training" | "wellness"
  | "tutoring" | "tech" | "event" | "home-repair" | "appliance" | "plumbing" | "electrical"
  | "graphic-design" | "video-editing" | "web-development" | "writing" | "marketing"
  | "virtual-assistance" | "consulting" | "bookkeeping" | "service";

export type ServiceCategoryIconConfig = {
  icon: ServiceCategoryIconName;
  background: string;
  foreground: string;
};

/** The single source of truth for category artwork used throughout the marketplace. */
export const SERVICE_CATEGORY_ICON_CONFIG = {
  "Home cleaning": { icon: "cleaning", background: "from-[#dff1e5] to-[#f6f3c7]", foreground: "#286047" },
  "Car detailing": { icon: "car", background: "from-[#dcecf1] to-[#e5efd8]", foreground: "#245a69" },
  "Lawn & garden": { icon: "garden", background: "from-[#e2f0d2] to-[#f5efc1]", foreground: "#48702f" },
  "Handyman": { icon: "handyman", background: "from-[#eee5d9] to-[#f7efc8]", foreground: "#7a542d" },
  Photography: { icon: "camera", background: "from-[#e5eee4] to-[#f3edcf]", foreground: "#315c47" },
  Videography: { icon: "video", background: "from-[#e1e8ef] to-[#ecebd5]", foreground: "#425b76" },
  "Pressure washing": { icon: "pressure-washing", background: "from-[#d9eef0] to-[#e6f0d9]", foreground: "#276777" },
  "Furniture assembly": { icon: "furniture", background: "from-[#eee5d9] to-[#f6efcf]", foreground: "#72542e" },
  "House painting": { icon: "painting", background: "from-[#f3e5d8] to-[#f5f0c8]", foreground: "#9a5840" },
  "Pet care": { icon: "pet", background: "from-[#f1e7d7] to-[#f4efca]", foreground: "#896039" },
  "Moving help": { icon: "moving", background: "from-[#e1e9e6] to-[#f0ebd6]", foreground: "#49675b" },
  "Junk removal": { icon: "junk", background: "from-[#e4e8e2] to-[#eee8d4]", foreground: "#57665c" },
  "Personal training": { icon: "training", background: "from-[#dcebdc] to-[#edf0c9]", foreground: "#3c704d" },
  "Beauty & wellness": { icon: "wellness", background: "from-[#f1e4e4] to-[#f4edca]", foreground: "#9a5265" },
  "Tutoring": { icon: "tutoring", background: "from-[#e1eaf0] to-[#eef0d8]", foreground: "#3e6378" },
  "Tech help": { icon: "tech", background: "from-[#ddebed] to-[#e9f0db]", foreground: "#326576" },
  "Event services": { icon: "event", background: "from-[#eee4ef] to-[#f3edcc]", foreground: "#765177" },
  "Home repair": { icon: "home-repair", background: "from-[#e4ece2] to-[#f0edcf]", foreground: "#46634e" },
  "Appliance repair": { icon: "appliance", background: "from-[#e0e8e8] to-[#edf0db]", foreground: "#456a6c" },
  "Plumbing": { icon: "plumbing", background: "from-[#dbecef] to-[#e5f0df]", foreground: "#2c6b78" },
  "Electrical": { icon: "electrical", background: "from-[#f2edcf] to-[#f5e4b9]", foreground: "#886f24" },
  "Graphic design": { icon: "graphic-design", background: "from-[#e9e3f0] to-[#f1ebcf]", foreground: "#70558a" },
  "Video editing": { icon: "video-editing", background: "from-[#e1e5ef] to-[#ecebd4]", foreground: "#4a5d89" },
  "Web development": { icon: "web-development", background: "from-[#dcebef] to-[#e5efdd]", foreground: "#2f6874" },
  "Writing & editing": { icon: "writing", background: "from-[#eee7dc] to-[#f2edcf]", foreground: "#765c42" },
  "Digital marketing": { icon: "marketing", background: "from-[#f1e6d8] to-[#f3edc7]", foreground: "#9a6633" },
  "Virtual assistance": { icon: "virtual-assistance", background: "from-[#e2eaf0] to-[#ecefd8]", foreground: "#4a6177" },
  "Consulting": { icon: "consulting", background: "from-[#e0e9e4] to-[#edf0d9]", foreground: "#44665b" },
  "Bookkeeping": { icon: "bookkeeping", background: "from-[#dfece2] to-[#ebf0d7]", foreground: "#39684c" },
} as const satisfies Record<(typeof SERVICE_CATEGORIES)[number], ServiceCategoryIconConfig>;

const FALLBACK_CATEGORY_ICON_CONFIG: ServiceCategoryIconConfig = {
  icon: "service",
  background: "from-[#e5eee4] to-[#f6efc8]",
  foreground: "#315c47",
};

export function getServiceCategoryIconConfig(category: string): ServiceCategoryIconConfig {
  return SERVICE_CATEGORY_ICON_CONFIG[category as keyof typeof SERVICE_CATEGORY_ICON_CONFIG] ?? FALLBACK_CATEGORY_ICON_CONFIG;
}
