import Link from "next/link";
import UiIcon from "@/components/ui-icon";

type HomeHeroPreviewProps = {
  href: string;
  city?: string;
  hasLocation: boolean;
};

function MapPin({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`home-preview-pin ${className}`} aria-hidden="true">
      <span>{children}</span>
    </span>
  );
}

function CleaningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.5 4.75h9M9 4.75V3.4h6v1.35M8.1 8.1h7.8l1.15 11.15H6.95L8.1 8.1Z" />
      <path d="M9.7 11.25h4.6M10.25 14.25h3.5" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5.25 15.75 1.3-5.15A2.1 2.1 0 0 1 8.6 9h6.8a2.1 2.1 0 0 1 2.05 1.6l1.3 5.15" />
      <path d="M4 15.75h16v3.1H4zM6.25 18.85v1.4M17.75 18.85v1.4M7 13h10" />
    </svg>
  );
}

function GardenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20V9.2M12 13.25c-3.55 0-5.4-1.7-5.4-4.95 3.55 0 5.4 1.7 5.4 4.95ZM12 10.25c0-3.15 1.8-4.85 5.4-4.85 0 3.2-1.8 4.85-5.4 4.85ZM7 20h10" />
    </svg>
  );
}

export default function HomeHeroPreview({ href, city, hasLocation }: HomeHeroPreviewProps) {
  const areaLabel = hasLocation && city ? city : "Your area";

  return (
    <div className="home-preview-wrap relative hidden lg:block">
      <div className="home-preview-aura absolute -inset-10 rounded-full" aria-hidden="true" />
      <Link
        href={href}
        aria-label={hasLocation && city ? `Browse services near ${city}` : "Browse available services"}
        className="home-preview-card group relative block rounded-[2.25rem] border p-4 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]"
      >
        <div className="home-preview-visual relative h-60 overflow-hidden rounded-[1.65rem]">
          <div className="home-preview-grid absolute inset-0" aria-hidden="true" />
          <div className="home-preview-road home-preview-road--one" aria-hidden="true" />
          <div className="home-preview-road home-preview-road--two" aria-hidden="true" />
          <div className="home-preview-park absolute -right-7 -top-8 h-40 w-40 rounded-full" aria-hidden="true" />

          <span className="home-preview-badge absolute left-4 top-4 inline-flex max-w-[72%] items-center gap-2 overflow-hidden whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.08em] text-ellipsis">
            <UiIcon name="map-pin" className="h-3.5 w-3.5" />
            {hasLocation ? `Browse ${areaLabel}` : "Browse nearby"}
          </span>

          <MapPin className="left-[12%] top-[57%]"><CleaningIcon /></MapPin>
          <MapPin className="right-[24%] top-[24%]"><GardenIcon /></MapPin>
          <MapPin className="right-[8%] top-[55%]"><CarIcon /></MapPin>

          <div className="home-preview-service absolute bottom-4 left-4 flex items-center gap-3 rounded-2xl p-3">
            <span className="home-preview-service-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl"><CleaningIcon /></span>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[.12em]">Service category</span>
              <span className="mt-0.5 block text-sm font-extrabold">Home cleaning</span>
            </span>
          </div>
        </div>

        <div className="px-2 pb-2 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xl font-extrabold tracking-[-.025em]">Compare services in one place.</p>
              <p className="mt-1.5 text-sm leading-5 text-[#65766d]">Compare services, message providers, and book with confidence.</p>
            </div>
            <span className="home-preview-arrow grid h-11 w-11 shrink-0 place-items-center rounded-lg" aria-hidden="true"><UiIcon name="arrow-right" className="h-5 w-5" /></span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="home-preview-stat rounded-2xl px-3 py-3">
              <span className="home-preview-stat-icon" aria-hidden="true"><UiIcon name="map-pin" className="h-3.5 w-3.5" /></span>
              <p className="mt-1 text-xs font-extrabold">Local matches</p>
            </div>
            <div className="home-preview-stat rounded-2xl px-3 py-3">
              <span className="home-preview-stat-icon" aria-hidden="true"><UiIcon name="messages" className="h-3.5 w-3.5" /></span>
              <p className="mt-1 text-xs font-extrabold">Direct chat</p>
            </div>
            <div className="home-preview-stat rounded-2xl px-3 py-3">
              <span className="home-preview-stat-icon" aria-hidden="true"><UiIcon name="lock" className="h-3.5 w-3.5" /></span>
              <p className="mt-1 text-xs font-extrabold">Secure booking</p>
            </div>
          </div>
        </div>
      </Link>

    </div>
  );
}
