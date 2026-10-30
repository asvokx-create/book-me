import BrandLockup from "@/components/brand-lockup";
import Link from "next/link";
import BugReportButton from "@/components/bug-report-button";
import { AnalyticsChoicesButton } from "@/components/analytics-consent";

const customerLinks = [
  ["Find services", "/#nearby-listings"],
  ["Service areas", "/locations"],
  ["Helpful guides", "/guides"],
  ["Our promise", "/promise"],
  ["Disputes", "/disputes"],
] as const;

const providerLinks = [
  ["List your service", "/providers/join"],
  ["Provider pricing", "/pricing"],
  ["Provider agreement", "/provider-agreement"],
  ["Provider safety", "/provider-safety"],
  ["Partner Program", "/partners"],
  ["Partner agreement", "/partner-agreement"],
] as const;

const companyLinks = [
  ["About Us", "/about"],
  ["AI & safety", "/ai-transparency"],
  ["Accessibility", "/accessibility"],
] as const;

const supportLinks = [
  ["Contact support", "/support"],
  ["Cancellation & refunds", "/cancellations-refunds"],
  ["Payment & billing", "/payment-billing"],
] as const;

const legalLinks = [
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["Marketing communications", "/marketing-communications"],
  ["Cookies", "/cookies"],
  ["Content removal", "/content-removal"],
  ["DMCA copyright", "/dmca"],
] as const;

function FooterLinks({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  const items = links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>);
  return (
    <div className="site-footer-links">
      <details className="site-footer-mobile-group">
        <summary><span>{title}</span><span aria-hidden="true">+</span></summary>
        <nav aria-label={`${title} links`}>{items}</nav>
      </details>
      <nav aria-label={title} className="site-footer-desktop-group">
        <p>{title}</p>
        <div>{items}</div>
      </nav>
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer mt-auto overflow-hidden border-t border-white/10 bg-[#0b2d22] text-white">
      <div className="site-container px-5 py-10 sm:px-6 sm:py-14">
        <div className="premium-footer-grid">
          <div className="premium-footer-brand">
            <Link href="/" aria-label="BubsBookings"><BrandLockup /></Link>
            <p>Your service marketplace for local and remote service providers across the United States.</p>
            <a href="https://saasbrowser.com/en/saas/1712492/bubsbookings" target="_blank" rel="nofollow noopener" className="premium-footer-badge">
              {/* The verification provider requires this badge to be served from its canonical URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://files.saasbrowser.com/n1c0ah9pbh67l9byez35xb5vhoy1" alt="BubsBookings - SaaS Browser Verified Badge" width="200" height="133" />
            </a>
            <div className="premium-footer-actions"><BugReportButton /><Link href="/support">Contact support</Link></div>
          </div>
          <FooterLinks title="For Customers" links={customerLinks} />
          <FooterLinks title="For Providers" links={providerLinks} />
          <FooterLinks title="Company" links={companyLinks} />
          <FooterLinks title="Support" links={supportLinks} />
          <FooterLinks title="Legal" links={legalLinks} />
        </div>
        <div className="premium-footer-bottom">
          <p>© {new Date().getFullYear()} BubsBookings. Built for local and remote work.</p>
          <AnalyticsChoicesButton className="rounded-md font-semibold underline-offset-4 hover:text-white hover:underline focus-visible:text-white" />
        </div>
      </div>
    </footer>
  );
}
