import BrandMark from "@/components/brand-mark";
import BrandWordmark from "@/components/brand-wordmark";

export default function BrandLockup({ priority = false, compact = false, markOnlyOnMobile = false }: { priority?: boolean; compact?: boolean; markOnlyOnMobile?: boolean }) {
  return (
    <span role="img" aria-label="BubsBookings" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <span aria-hidden="true" className="contents">
        <BrandMark priority={priority} className="h-9 w-9 rounded-xl shadow-[0_7px_18px_rgba(23,61,46,.18)] sm:h-10 sm:w-10" />
        <span className={markOnlyOnMobile ? "hidden sm:inline" : "contents"}><BrandWordmark compact={compact} /></span>
      </span>
    </span>
  );
}
