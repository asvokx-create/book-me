import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Local service guides",
  description: "Practical BubsBookings guides for comparing, hiring, and working with local service providers.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-[#eee25a]">B</span>BubsBookings</Link><Link href="/services" className="rounded-full px-4 py-2 text-sm font-bold hover:bg-[#eee25a]">Explore services</Link></div></header><section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">Helpful local advice</p><h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">Book local help with more confidence.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">Clear, practical guides for comparing providers, preparing for a service, and avoiding surprises.</p><div className="mt-10 grid gap-5 md:grid-cols-2">{GUIDES.map((guide) => <article key={guide.slug} className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_8px_25px_rgba(24,49,38,.05)] sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">{guide.category} · {guide.readMinutes} min read</p><h2 className="mt-3 text-2xl font-bold tracking-tight">{guide.title}</h2><p className="mt-3 text-sm leading-6 text-[#64766c]">{guide.description}</p><Link href={`/guides/${guide.slug}`} className="mt-6 inline-flex rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846]">Read guide →</Link></article>)}</div></section></main>;
}
