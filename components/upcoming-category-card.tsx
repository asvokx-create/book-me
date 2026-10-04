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
      className="home-upcoming-category flex min-h-12 min-w-0 items-center gap-3 rounded-lg border border-[#183126]/12 bg-white px-3 py-2.5 text-[13px] font-bold leading-tight transition hover:border-[#6d8d78] hover:bg-[#fbfcf8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/60 sm:text-sm"
    >
      <ServiceCategoryIcon category={category} compact />
      <span className="home-upcoming-label min-w-0 flex-1">{category}</span>
    </Link>
  );
}
