import Link from "next/link";
import ServiceCategoryIcon from "@/components/service-category-icon";

type UpcomingCategoryCardProps = {
  category: string;
  href: string;
};

export default function UpcomingCategoryCard({ category, href }: UpcomingCategoryCardProps) {
  return (
    <Link
      href={href}
      className="home-upcoming-category flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-[#183126]/10 bg-white/70 px-2.5 py-2.5 text-[13px] font-bold leading-tight transition hover:border-[#6d8d78] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/60 active:scale-[.98] sm:px-3 sm:text-sm"
    >
      <ServiceCategoryIcon category={category} compact />
      <span className="min-w-0 flex-1 whitespace-normal break-words">{category}</span>
    </Link>
  );
}
