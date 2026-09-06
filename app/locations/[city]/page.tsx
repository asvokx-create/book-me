import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServices, getServiceVisual } from "@/lib/marketplace";
import { FEATURED_SERVICE_CATEGORIES } from "@/lib/service-categories";
import { getServiceAreaBySlug, SERVICE_AREAS, serviceAreaLabel, serviceAreaSlug } from "@/lib/service-areas";

export const dynamic = "force-dynamic";

export function generateStaticParams() { return SERVICE_AREAS.map((area) => ({ city: serviceAreaSlug(area) })); }

export async function generateMetadata({ params }: PageProps<"/locations/[city]">): Promise<Metadata> {
  const { city } = await params;
  const area = getServiceAreaBySlug(city);
  if (!area) return {};
  const title = `Local services in ${area.city}, ${area.state}`;
  const description = `Find and compare local service providers near ${area.city}, ${area.state} on BubsBookings.`;
  return { title, description, alternates: { canonical: `/locations/${serviceAreaSlug(area)}` }, openGraph: { title, description, url: `/locations/${serviceAreaSlug(area)}` } };
}

export default async function LocationPage({ params }: PageProps<"/locations/[city]">) {
  const { city } = await params;
  const area = getServiceAreaBySlug(city);
  if (!area) notFound();
  const location = serviceAreaLabel(area);
  const services = await getServices({ location, radiusMiles: 25, sort: "nearest", limit: 12 });
  const searchHref = `/services?location=${encodeURIComponent(location)}&radius=25#service-listings`;
  const jsonLd = { "@context": "https://schema.org", "@type": "ItemList", name: `Local services near ${location}`, numberOfItems: services.length, itemListElement: services.map((service, index) => ({ "@type": "ListItem", position: index + 1, url: `https://bubsbookings.com/services/${service.slug}`, name: service.title })) };
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-[#eee25a]">B</span>BubsBookings</Link><Link href="/locations" className="text-sm font-bold">All service areas</Link></div></header><section className="border-b border-[#183126]/10 bg-[radial-gradient(circle_at_85%_15%,rgba(206,225,198,.8),transparent_28%)]"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">Local marketplace</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-6xl">Services in {area.city}, {area.state}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">Compare active local listings within 25 miles of {area.city}. Review service details, availability, and starting prices before requesting a booking.</p><div className="mt-7 flex flex-wrap gap-2">{FEATURED_SERVICE_CATEGORIES.map((category) => <Link key={category} href={`/services?category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}&radius=25#service-listings`} className="rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-sm font-bold transition hover:bg-[#eee25a]">{category}</Link>)}</div></div></section><section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-[#6d7c75]">{services.length} nearby {services.length === 1 ? "listing" : "listings"}</p><h2 className="mt-1 text-3xl font-bold">Available near {area.city}</h2></div><Link href={searchHref} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold">Search all nearby</Link></div>{services.length ? <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map((service) => <Link key={service.id} href={`/services/${service.slug}`} className="group overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_22px_rgba(24,49,38,.05)] transition hover:-translate-y-1"><div style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`grid h-48 place-items-center bg-cover bg-center text-6xl ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${getServiceVisual(service.category).gradient}`}`}>{service.imageUrls[0] ? "" : getServiceVisual(service.category).art}</div><div className="p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">{service.category}</p><h3 className="mt-2 text-xl font-bold">{service.title}</h3><p className="mt-2 text-sm text-[#6b7b73]">{service.provider} · {service.distanceMiles?.toFixed(1)} mi</p><p className="mt-4 font-bold">From ${service.price}</p></div></Link>)}</div> : <div className="mt-8 rounded-[2rem] border border-[#183126]/10 bg-white p-10 text-center"><h2 className="text-xl font-bold">No nearby listings yet</h2><p className="mt-2 text-sm text-[#6b7b73]">BubsBookings is growing in {area.city}. Explore a wider area or become one of the first local providers.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={searchHref} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Widen your search</Link><Link href="/providers/join" className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold">List a service</Link></div></div>}</section></main>;
}
