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
        className="object-contain object-left"
      />
    </span>
  );
}
