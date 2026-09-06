import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_AREAS, serviceAreaSlug } from "@/lib/service-areas";

export const metadata: Metadata = {
  title: "Local service areas",
  description: "Explore local professionals and services across the communities served by BubsBookings.",
  alternates: { canonical: "/locations" },
};

export default function LocationsPage() {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-[#eee25a]">B</span>BubsBookings</Link><Link href="/services" className="rounded-full px-4 py-2 text-sm font-bold hover:bg-[#eee25a]">Search services</Link></div></header><section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">Service areas</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-6xl">Find local help near you.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">Explore active BubsBookings listings around communities in the greater Seattle and Eastside area.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_AREAS.map((area) => <Link key={area.city} href={`/locations/${serviceAreaSlug(area)}`} className="group rounded-[1.5rem] border border-[#183126]/10 bg-white p-6 shadow-[0_5px_18px_rgba(24,49,38,.04)] transition hover:-translate-y-1 hover:border-[#557463]"><span className="text-xl">📍</span><h2 className="mt-4 text-xl font-bold">{area.city}, {area.state}</h2><p className="mt-2 text-sm text-[#6b7b73]">Browse nearby services <span className="transition group-hover:translate-x-1">→</span></p></Link>)}</div></section></main>;
}
