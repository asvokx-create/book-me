export default function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-wordmark-text shrink-0 whitespace-nowrap ${compact ? "text-[1.05rem] sm:text-[1.2rem]" : "text-[1.05rem] min-[390px]:text-[1.2rem] sm:text-[1.4rem]"}`}>
      <span className="brand-wordmark-bubs">Bubs</span><span className="brand-wordmark-bookings">Bookings</span>
    </span>
  );
}
