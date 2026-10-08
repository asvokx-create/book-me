import type { ReactNode } from "react";
import { getServiceCategoryIconConfig, type ServiceCategoryIconName } from "@/lib/service-category-icons";

type CategoryIconProps = { category: string; className?: string; compact?: boolean };

function Illustration({ icon }: { icon: ServiceCategoryIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  const icons: Record<ServiceCategoryIconName, ReactNode> = {
    cleaning: <><path {...common} d="M19 15h11l3 5v18H15V20l4-5Z" /><path {...common} d="M21 15v-4h9l4 3M16 24h16M20 29h8" /><path {...common} d="m36 9 1.2 2.8L40 13l-2.8 1.2L36 17l-1.2-2.8L32 13l2.8-1.2L36 9Z" /></>,
    car: <><path {...common} d="m11 29 3.5-9h19l4.5 9v7H10v-5.5c0-.8.4-1.3 1-1.5Z" /><path {...common} d="M16 20 19 14h11l3.5 6M14 29h20" /><circle {...common} cx="17" cy="36" r="3" /><circle {...common} cx="32" cy="36" r="3" /><path {...common} d="m39 10 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1 1-2.2Z" /></>,
    garden: <><path {...common} d="M24 39V20" /><path {...common} d="M24 27c-7 0-11-4-11-11 7 0 11 4 11 11ZM24 22c0-7 4-11 11-11 0 7-4 11-11 11Z" /><path {...common} d="M10 39h28M15 39c1.5-3 3.5-4.5 6-4.5M33 39c-1-2.2-2.5-3.4-4.5-3.4" /></>,
    handyman: <><path {...common} d="m14 34 17-17M29 14l3-3 5 5-3 3M12 31l5 5-3 3a2.8 2.8 0 0 1-4-4l2-4Z" /><path {...common} d="M29 27 39 37l-4 4-10-10M11 12l7 2 4 7-4 4-7-4-3-6 3-3Z" /></>,
    camera: <><path {...common} d="M10 18h8l3-5h8l3 5h6v21H10V18Z" /><circle {...common} cx="24" cy="28" r="7" /><circle cx="24" cy="28" r="2.5" fill="currentColor" /><path {...common} d="m39 8 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1L39 8Z" /></>,
    video: <><rect {...common} x="9" y="15" width="23" height="20" rx="3" /><path {...common} d="m32 21 8-4v16l-8-4V21ZM18 21l7 4-7 4v-8Z" /></>,
    "pressure-washing": <><path {...common} d="M10 31h15l4 7H14l-4-7ZM16 31l5-14h8M28 17h8l4 5" /><path {...common} d="m39 24 2 2m-6 1 2 3m-6-1 1 3M19 38v3m8-3v3" /></>,
    furniture: <><path {...common} d="M14 24v16m20-16v16M14 25c0-7 4-11 10-11s10 4 10 11v7H14v-7Z" /><path {...common} d="M18 22h12M11 40h26" /></>,
    painting: <><path {...common} d="M12 12h17v10H12zM20.5 22v16M16 38h9M29 15h5v9h-5M34 19h4c0 6-4 9-9 9" /></>,
    pet: <><circle {...common} cx="16" cy="18" r="3" /><circle {...common} cx="25" cy="13" r="3" /><circle {...common} cx="34" cy="18" r="3" /><path {...common} d="M14 34c0-6 4-10 10-10s10 4 10 10c0 4-4 6-10 6s-10-2-10-6Z" /></>,
    moving: <><path {...common} d="M8 18h21v17H8zM29 23h6l5 5v7H29z" /><circle {...common} cx="16" cy="37" r="3" /><circle {...common} cx="34" cy="37" r="3" /><path {...common} d="M14 23h9M19 18v17" /></>,
    junk: <><path {...common} d="M13 16h22l-2 24H15l-2-24ZM10 16h28M19 12h10M20 22v12m8-12v12" /></>,
    training: <><path {...common} d="M8 20v8m5-12v16m6-9h10m5-7v16m5-12v8M13 18h6v12h-6zM29 18h6v12h-6z" /></>,
    wellness: <><circle {...common} cx="24" cy="24" r="4" /><path {...common} d="M24 10c6 3 8 7 4 11M38 24c-3 6-7 8-11 4M24 38c-6-3-8-7-4-11M10 24c3-6 7-8 11-4M14 14c5-1 9 1 10 6m10-6c-1 5-5 7-10 6m10 14c-5 1-9-1-10-6m-10 6c1-5 5-7 10-6" /></>,
    tutoring: <><path {...common} d="M11 13h12c3 0 5 2 5 5v20c0-3-2-5-5-5H11V13ZM37 13H25c-3 0-5 2-5 5v20c0-3 2-5 5-5h12V13Z" /><path {...common} d="M15 19h8m-8 6h8" /></>,
    tech: <><rect {...common} x="9" y="13" width="30" height="21" rx="2" /><path {...common} d="M18 40h12m-6-6v6M20 21l-4 3 4 3m8-6 4 3-4 3" /></>,
    event: <><rect {...common} x="10" y="13" width="28" height="27" rx="3" /><path {...common} d="M10 21h28M17 10v6m14-6v6M17 28h5m4 0h5m-14 6h5m4 0h5" /></>,
    "home-repair": <><path {...common} d="m9 24 15-13 15 13v16H9V24ZM20 40V29h8v11M31 17l5-5 4 4-5 5m-6 4 8-8" /></>,
    appliance: <><rect {...common} x="13" y="9" width="22" height="32" rx="3" /><path {...common} d="M13 21h22M19 15h.1m5 0h.1M18 28h12m-12 6h12" /></>,
    plumbing: <><path {...common} d="M11 12v11h13v13h13M17 12h12v7H17zM31 31c0-4 5-8 5-8s5 4 5 8a5 5 0 0 1-10 0Z" /></>,
    electrical: <><path {...common} d="M18 10v10m12-10v10M16 20h16v8a8 8 0 0 1-16 0v-8ZM24 36v5m-5 0h10M27 21l-5 7h5l-3 6" /></>,
    "graphic-design": <><path {...common} d="M12 36 31 17l6 6-19 19-7 1 1-7ZM27 13l3-3 7 7-3 3M12 29l7 7" /><circle {...common} cx="15" cy="14" r="4" /></>,
    "video-editing": <><path {...common} d="M10 17h28v21H10zM10 24h28M15 12l3 5m4-5 3 5m4-5 3 5M21 28l7 4-7 4v-8Z" /></>,
    "web-development": <><rect {...common} x="8" y="10" width="32" height="28" rx="3" /><path {...common} d="M8 17h32M14 14h.1m5 0h.1M20 23l-5 5 5 5m8-10 5 5-5 5m-3-12-3 14" /></>,
    writing: <><path {...common} d="M13 38h22M16 34l2-8L31 13l5 5-13 13-7 3ZM28 16l5 5M13 12h12m-12 6h8" /></>,
    marketing: <><path {...common} d="M10 26h6l16-9v18l-16-9h-6v-6ZM16 27l2 11h6l-2-8M35 20c2 2 3 4 3 6s-1 4-3 6" /></>,
    "virtual-assistance": <><rect {...common} x="12" y="10" width="24" height="31" rx="3" /><path {...common} d="M19 10v-3h10v3M18 20h12m-12 7h7m-7 7h10m1-7 2 2 4-4" /></>,
    consulting: <><path {...common} d="M11 12h26v18H25l-7 7v-7h-7V12ZM17 23h4v-5m0 5 5-7 4 4" /></>,
    bookkeeping: <><rect {...common} x="13" y="9" width="22" height="32" rx="3" /><path {...common} d="M18 15h12m-12 7h4m4 0h4m-12 7h4m4 0h4m-12 6h12" /></>,
    service: <><path {...common} d="M11 15h26v22H11zM17 15v-4h14v4M17 24h14m-14 7h8" /></>,
  };
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12">{icons[icon]}</svg>;
}

export default function ServiceCategoryIcon({ category, className = "", compact = false }: CategoryIconProps) {
  const style = getServiceCategoryIconConfig(category);
  return <span className={`relative grid shrink-0 aspect-square place-items-center overflow-hidden bg-gradient-to-br shadow-[inset_0_0_0_1px_rgba(24,49,38,.08)] ${compact ? "h-10 min-h-10 w-10 min-w-10 rounded-lg [&_svg]:h-8 [&_svg]:w-8" : "h-16 min-h-16 w-16 min-w-16 rounded-xl"} ${style.background} ${className}`} style={{ color: style.foreground }}><span className="service-category-icon-decoration absolute -right-3 -top-3 h-10 w-10 rounded-full bg-white/45" /><span className="relative"><Illustration icon={style.icon} /></span></span>;
}
