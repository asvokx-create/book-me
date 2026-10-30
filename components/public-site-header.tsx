import Link from "next/link";
import AccountNav from "@/components/account-nav";
import BrandLockup from "@/components/brand-lockup";
import MobileSiteNav from "@/components/mobile-site-nav";
import UiIcon from "@/components/ui-icon";

const primaryLinks = [
  ["Find a Service", "/#nearby-listings"],
  ["For Providers", "/providers/join"],
  ["How It Works", "/#how-it-works"],
  ["Resources", "/guides"],
] as const;

type PublicSiteHeaderProps = { className?: string };

export default function PublicSiteHeader({ className = "" }: PublicSiteHeaderProps) {
  return (
    <header className={`public-site-header ${className}`.trim()}>
      <div className="site-container-wide flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="BubsBookings home" className="public-site-logo flex min-w-0 items-center gap-2.5">
          <BrandLockup priority />
        </Link>
        <nav aria-label="Primary navigation" className="public-site-nav hidden items-center lg:flex">
          {primaryLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="public-site-actions flex items-center gap-2">
          <Link href="/#nearby-listings" aria-label="Search services" className="public-site-search hidden sm:grid"><UiIcon name="search" /></Link>
          <MobileSiteNav />
          <div className="public-site-account"><AccountNav /></div>
        </div>
      </div>
    </header>
  );
}
