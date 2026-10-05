import Image from "next/image";
import Link from "next/link";
import UiIcon from "@/components/ui-icon";

type HomeHeroPreviewProps = {
  href: string;
  city?: string;
  hasLocation: boolean;
};

export default function HomeHeroPreview({ href, city, hasLocation }: HomeHeroPreviewProps) {
  return (
    <div className="home-preview-wrap relative hidden lg:block">
      <div className="home-preview-aura absolute -inset-10 rounded-full" aria-hidden="true" />
      <Link
        href={href}
        aria-label={hasLocation && city ? `Browse services near ${city}` : "Browse available services"}
        className="home-preview-card group relative block rounded-[2.25rem] border p-4 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]"
      >
        <div className="home-preview-visual relative aspect-[3/2] overflow-hidden rounded-[1.65rem]">
          <Image
            src="/images/browse-services-city-map.png"
            alt="Illustrated city map showing local home, repair, pet, photography, and transportation services"
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 1024px) 36vw, 0px"
            className="h-full w-full object-cover"
          />
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
