import BrandMark from "@/components/brand-mark";
import BrandWordmark from "@/components/brand-wordmark";

export default function BrandLockup({ priority = false, compact = false }: { priority?: boolean; compact?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      <BrandMark priority={priority} className="h-9 w-9 rounded-xl shadow-[0_7px_18px_rgba(23,61,46,.18)] sm:h-10 sm:w-10" />
      <BrandWordmark compact={compact} />
    </span>
  );
}
