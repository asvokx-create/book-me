import BrandMark from "@/components/brand-mark";
import Link from "next/link";
import BugReportButton from "@/components/bug-report-button";

const marketplaceLinks = [
  ["Find services", "/services"],
  ["Service areas", "/locations"],
  ["Helpful guides", "/guides"],
  ["List your service", "/providers/join"],
] as const;

const trustLinks = [
  ["Our promise", "/promise"],
  ["AI & safety", "/ai-transparency"],
  ["Disputes", "/disputes"],
  ["Accessibility", "/accessibility"],
] as const;

const legalLinks = [
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["Provider agreement", "/provider-agreement"],
  ["Cookies", "/cookies"],
  ["Content removal", "/content-removal"],
] as const;

function FooterLinks({ title, links }: { title: string; links: ReadonlyArray<readonly [string, string]> }) {
  return (
    <nav aria-label={title}>
      <p className="text-[11px] font-bold uppercase tracking-[.17em] text-[#88a596]">{title}</p>
      <div className="mt-4 grid gap-2.5 text-sm font-semibold text-[#c8d7cf]">
        {links.map(([label, href]) => <Link key={href} href={href} className="w-fit rounded-md py-0.5 transition hover:translate-x-1 hover:text-white">{label}</Link>)}
      </div>
    </nav>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer mt-auto overflow-hidden border-t border-white/10 bg-[linear-gradient(145deg,#102b20,#0b2118_60%,#123426)] text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.065] p-6 shadow-[0_24px_70px_rgba(0,0,0,.18)] sm:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#eee25a]/10 blur-3xl" />
          <div className="relative grid items-end gap-7 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#a9c3b4]">Your neighborhood marketplace</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-.045em] sm:text-4xl">Good help should never feel far away.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#aec3b8]">Find trusted local professionals, compare your options clearly, and keep every booking in one secure place.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/services" className="rounded-full bg-[#f1e45c] px-6 py-3.5 text-sm font-bold text-[#173d2e] hover:bg-[#fff47c]">Find local help</Link>
              <Link href="/providers/join" className="rounded-full border border-white/20 bg-white/8 px-6 py-3.5 text-sm font-bold hover:border-white/30 hover:bg-white/14">List your service</Link>
            </div>
          </div>
          <div className="relative mt-7 grid gap-3 border-t border-white/10 pt-6 text-xs font-semibold text-[#bfd0c7] sm:grid-cols-3">
            <p className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/8 text-[#eee25a]">✓</span>Local-first marketplace</p>
            <p className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/8 text-[#eee25a]">✓</span>Secure Stripe payments</p>
            <p className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-white/8 text-[#eee25a]">✓</span>Real booking support</p>
          </div>
        </section>

        <div className="grid gap-10 py-11 sm:grid-cols-2 lg:grid-cols-[1.35fr_.8fr_.8fr_.8fr]">
          <div>
            <Link href="/" className="flex w-fit items-center gap-3 text-xl font-bold tracking-[-.03em]"><BrandMark className="grid h-11 w-11 place-items-center rounded-[.9rem] bg-[#f1e45c] text-base text-[#173d2e] shadow-[0_10px_25px_rgba(0,0,0,.2)]" />BubsBookings</Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#9db5a8]">Local services, safer conversations, clear choices—and a simpler way to get things done.</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <BugReportButton />
              <a href="mailto:christian@bubsbookings.com" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-[#c8d7cf] hover:bg-white/10 hover:text-white">Contact support</a>
            </div>
          </div>
          <FooterLinks title="Marketplace" links={marketplaceLinks} />
          <FooterLinks title="Trust & support" links={trustLinks} />
          <FooterLinks title="Legal" links={legalLinks} />
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-[#7f9b8c] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} BubsBookings. Built for local people and local work.</p>
          <p>Issaquah, Washington · Serving nearby communities</p>
        </div>
      </div>
    </footer>
  );
}
