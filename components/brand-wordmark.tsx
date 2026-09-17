import Image from "next/image";

export default function BrandWordmark({ className = "h-8 w-[179px]", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`brand-wordmark relative block shrink-0 ${className}`}>
      <Image
        src="/brand-wordmark.png"
        alt="BubsBookings"
        fill
        priority={priority}
        sizes="(max-width: 390px) 136px, 180px"
        className="brand-wordmark-light object-contain object-left"
      />
      <Image
        src="/brand-wordmark-dark.png"
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 390px) 136px, 180px"
        className="brand-wordmark-dark object-contain object-left"
      />
    </span>
  );
}
