import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export default function BrandMark({ className = "h-9 w-9", priority = false }: BrandMarkProps) {
  return (
    <span aria-hidden="true" className={`relative block shrink-0 overflow-hidden ${className}`}>
      <Image
        src="/brand-icon.png"
        alt=""
        fill
        priority={priority}
        sizes="48px"
        className="object-cover"
      />
    </span>
  );
}
