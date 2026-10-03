export type ProviderDashboardIconName =
  | "overview"
  | "bookings"
  | "opportunities"
  | "calendar"
  | "messages"
  | "revenue"
  | "services"
  | "profile"
  | "marketing"
  | "locations"
  | "availability"
  | "reviews"
  | "team"
  | "billing"
  | "settings";

export default function ProviderDashboardIcon({ name, className = "h-4 w-4" }: { name: ProviderDashboardIconName; className?: string }) {
  let glyph;

  switch (name) {
    case "overview":
      glyph = <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>;
      break;
    case "bookings":
      glyph = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8.5 15.5l2 2 4-4" /></>;
      break;
    case "opportunities":
      glyph = <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>;
      break;
    case "calendar":
      glyph = <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" /></>;
      break;
    case "messages":
      glyph = <path d="M21 12a8 8 0 0 1-8 8H6l-4 2 1.5-4A8.5 8.5 0 1 1 21 12Z" />;
      break;
    case "revenue":
      glyph = <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>;
      break;
    case "services":
      glyph = <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6V4h6v2M3 11h18M10 11v2h4v-2" /></>;
      break;
    case "profile":
      glyph = <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="9" r="3" /><path d="M6.8 19a5.5 5.5 0 0 1 10.4 0" /></>;
      break;
    case "marketing":
      glyph = <><path d="M4 13v-2l12-5v12L4 13Z" /><path d="M16 10.5a3 3 0 0 1 0 3M7 14l1.5 5h3L10 13" /></>;
      break;
    case "locations":
      glyph = <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>;
      break;
    case "availability":
      glyph = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>;
      break;
    case "reviews":
      glyph = <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />;
      break;
    case "team":
      glyph = <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15a4.5 4.5 0 0 1 6.5 4" /></>;
      break;
    case "billing":
      glyph = <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>;
      break;
    case "settings":
      glyph = <><path d="M4 6h5M13 6h7M4 12h9M17 12h3M4 18h2M10 18h10" /><circle cx="11" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>;
      break;
  }

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{glyph}</svg>;
}
