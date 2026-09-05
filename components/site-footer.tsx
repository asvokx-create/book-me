import Link from "next/link";
import BugReportButton from "@/components/bug-report-button";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#183126]/10 bg-[#f1f2ec] text-[#183126]">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-bold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#183126] text-xs text-[#eee25a]">B</span>BubsBookings</p>
          <p className="mt-2 text-xs text-[#6d7c74]">Local services, safer conversations, clear choices.</p>
          <div className="mt-3 w-fit rounded-lg border border-[#183126]/10 bg-white px-1 py-0.5 shadow-sm"><BugReportButton /></div>
        </div>
        <nav aria-label="Legal and safety" className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <Link href="/terms" className="rounded-lg px-2 py-1 transition hover:bg-[#dfe7da]">Terms</Link>
          <Link href="/privacy" className="rounded-lg px-2 py-1 transition hover:bg-[#dfe7da]">Privacy</Link>
          <Link href="/ai-transparency" className="rounded-lg px-2 py-1 transition hover:bg-[#dfe7da]">AI & safety</Link>
          <Link href="/disputes" className="rounded-lg px-2 py-1 transition hover:bg-[#dfe7da]">Disputes</Link>
        </nav>
      </div>
    </footer>
  );
}
