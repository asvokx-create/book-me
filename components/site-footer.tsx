import Link from "next/link";
import BugReportButton from "@/components/bug-report-button";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-[#112c21] text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col justify-between gap-7 border-b border-white/10 pb-9 md:flex-row md:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a9c3b4]">Your neighborhood marketplace</p><h2 className="mt-2 max-w-xl text-2xl font-bold tracking-[-.035em] sm:text-3xl">Good help should never feel far away.</h2></div>
          <div className="flex flex-wrap gap-3"><Link href="/services" className="rounded-full bg-[#f1e45c] px-5 py-3 text-sm font-bold text-[#173d2e] shadow-lg hover:-translate-y-0.5 hover:bg-[#fff47c]">Find local help</Link><Link href="/providers/join" className="rounded-full border border-white/20 bg-white/8 px-5 py-3 text-sm font-bold hover:bg-white/15">List your service</Link></div>
        </div>
        <div className="flex flex-col gap-7 pt-9 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2.5 text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f1e45c] text-sm text-[#173d2e]">B</span>BubsBookings</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#a9bdb2]">Local services, safer conversations, clear choices—and a simpler way to get things done.</p>
            <div className="mt-4 w-fit rounded-xl border border-white/10 bg-white/8 px-1 py-0.5 text-white"><BugReportButton /></div>
          </div>
          <nav aria-label="Legal and safety" className="flex max-w-2xl flex-wrap gap-x-3 gap-y-2 text-sm font-semibold text-[#d2ddd6]">
            <Link href="/locations" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Service areas</Link>
            <Link href="/guides" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Blog</Link>
            <Link href="/terms" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Terms</Link>
            <Link href="/privacy" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Privacy</Link>
            <Link href="/provider-agreement" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Providers</Link>
            <Link href="/ai-transparency" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">AI & safety</Link>
            <Link href="/disputes" className="rounded-lg px-2 py-1 hover:bg-white/10 hover:text-white">Disputes</Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/10 pt-6 text-xs text-[#829b8d]">© {new Date().getFullYear()} BubsBookings. Built for local people and local work.</p>
      </div>
    </footer>
  );
}
