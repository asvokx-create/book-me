import type { Metadata } from "next";
import Link from "next/link";
import { getServices, getServiceVisual } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import { FEATURED_SERVICE_CATEGORIES, SERVICE_CATEGORIES, SERVICE_CATEGORY_ICONS } from "@/lib/service-categories";
import LocationFilter from "@/components/location-filter";
import SortSelect from "@/components/sort-select";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore local services | BookMe",
  description: "Search trusted local service providers near Issaquah.",
};

const quickCategories = ["All services", ...FEATURED_SERVICE_CATEGORIES];

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const selectedCategory = getParam(params.category) || "All services";
  const location = getParam(params.location) || "Issaquah, WA";
  const radius = Number(getParam(params.radius)) || 10;
  const maxPrice = Number(getParam(params.maxPrice)) || undefined;
  const maxDuration = Number(getParam(params.maxDuration)) || undefined;
  const sort = getParam(params.sort) || "nearest";
  const filteredServices = await getServices({ query, category: selectedCategory, location, radiusMiles: radius, maxPrice, maxDuration, sort });

  function serviceHref(category: string) {
    const queryString = new URLSearchParams();
    if (query) queryString.set("q", query);
    if (category !== "All services") queryString.set("category", category);
    queryString.set("location", location);
    queryString.set("radius", String(radius));
    if (maxPrice) queryString.set("maxPrice", String(maxPrice));
    if (maxDuration) queryString.set("maxDuration", String(maxDuration));
    if (sort !== "nearest") queryString.set("sort", sort);
    return `/services?${queryString.toString()}`;
  }

  function removeFilter(name: "location" | "radius" | "category" | "maxPrice" | "maxDuration") {
    const queryString = new URLSearchParams();
    if (query) queryString.set("q", query);
    if (selectedCategory !== "All services" && name !== "category") queryString.set("category", selectedCategory);
    queryString.set("location", name === "location" ? "Issaquah, WA" : location);
    queryString.set("radius", String(name === "radius" || name === "location" ? 10 : radius));
    if (maxPrice && name !== "maxPrice") queryString.set("maxPrice", String(maxPrice));
    if (maxDuration && name !== "maxDuration") queryString.set("maxDuration", String(maxDuration));
    if (sort !== "nearest") queryString.set("sort", sort);
    return `/services?${queryString.toString()}`;
  }

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-[#f8f7f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            BookMe
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/pricing" className="hidden rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-[#183126]/5 md:block">Pricing</Link>
            <Link href="/providers/join" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:block">List your service</Link>
            <AccountNav />
          </div>
        </div>
      </header>

      <section className="border-b border-[#183126]/10 bg-[radial-gradient(circle_at_85%_15%,rgba(206,225,198,.8),transparent_25%)]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <Link href="/" className="text-sm font-semibold text-[#64776d] transition hover:text-[#183126]">← Home</Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">Explore nearby</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-.05em] sm:text-5xl">Find the right help for the job.</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#5d7066]">Compare trusted local providers, prices, and availability around {location}.</p>

          <form action="/services" className="mt-8 flex max-w-4xl flex-col gap-2 rounded-3xl border border-[#183126]/10 bg-white p-2.5 shadow-[0_14px_40px_rgba(24,49,38,.1)] sm:flex-row sm:rounded-full">
            <label className="flex flex-1 items-center gap-3 px-4 py-3">
              <span aria-hidden="true">🔎</span>
              <span className="sr-only">Search services</span>
              <input name="q" defaultValue={query} placeholder="Try “cleaning” or “lawn care”" className="w-full bg-transparent text-sm outline-none placeholder:text-[#8a9790]" />
            </label>
            <div className="border-t border-[#183126]/10 sm:min-w-[330px] sm:border-l sm:border-t-0"><LocationFilter initialLocation={location} initialRadius={radius} restoreRemembered={!getParam(params.location)} /></div>
            {selectedCategory !== "All services" && <input type="hidden" name="category" value={selectedCategory} />}
            {maxPrice && <input type="hidden" name="maxPrice" value={maxPrice} />}
            {maxDuration && <input type="hidden" name="maxDuration" value={maxDuration} />}
            {sort !== "nearest" && <input type="hidden" name="sort" value={sort} />}
            <button type="submit" className="rounded-full bg-[#eee25a] px-7 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Search</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {quickCategories.map((category) => {
            const active = category === selectedCategory;
            return (
              <Link key={category} href={serviceHref(category)} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${active ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/12 bg-white hover:border-[#496958] hover:bg-[#edf3e7]"}`}>{category}</Link>
            );
          })}
          <details className="group shrink-0">
            <summary className="list-none rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#496958] hover:bg-[#edf3e7] [&::-webkit-details-marker]:hidden">More filters <span className="inline-block transition group-open:rotate-180">⌄</span></summary>
            <div className="absolute left-5 right-5 z-20 mt-3 rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 shadow-[0_20px_55px_rgba(24,49,38,.15)] sm:left-auto sm:right-8 sm:w-[620px] sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">All categories</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{SERVICE_CATEGORIES.map((category) => <Link key={category} href={serviceHref(category)} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition hover:bg-[#edf3e7] ${selectedCategory === category ? "border-[#183126] bg-[#edf3e7]" : "border-[#183126]/10"}`}><span>{SERVICE_CATEGORY_ICONS[category] ?? "✨"}</span>{category}</Link>)}</div>
              <form action="/services" className="mt-6 grid gap-4 border-t border-[#183126]/10 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                {query && <input type="hidden" name="q" value={query} />}<input type="hidden" name="location" value={location} /><input type="hidden" name="radius" value={radius} />{selectedCategory !== "All services" && <input type="hidden" name="category" value={selectedCategory} />}{sort !== "nearest" && <input type="hidden" name="sort" value={sort} />}
                <label><span className="mb-2 block text-xs font-bold">Maximum price</span><select name="maxPrice" defaultValue={maxPrice ?? ""} className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-3 py-3 text-sm outline-none"><option value="">Any price</option><option value="50">Up to $50</option><option value="100">Up to $100</option><option value="250">Up to $250</option><option value="500">Up to $500</option></select></label>
                <label><span className="mb-2 block text-xs font-bold">Maximum duration</span><select name="maxDuration" defaultValue={maxDuration ?? ""} className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-3 py-3 text-sm outline-none"><option value="">Any duration</option><option value="60">Up to 1 hour</option><option value="120">Up to 2 hours</option><option value="240">Up to half day</option><option value="480">Up to full day</option></select></label>
                <button type="submit" className="rounded-xl bg-[#eee25a] px-5 py-3 text-sm font-bold transition hover:bg-[#f5ea6b]">Apply filters</button>
              </form>
            </div>
          </details>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-[#718078]">Active filters</span>
          <Link href={removeFilter("location")} title="Reset location" className="rounded-full bg-[#edf3e7] px-3 py-2 transition hover:bg-[#dce9d8]">📍 {location} ×</Link>
          <Link href={removeFilter("radius")} title="Reset radius" className="rounded-full bg-[#edf3e7] px-3 py-2 transition hover:bg-[#dce9d8]">Within {radius} mi ×</Link>
          {selectedCategory !== "All services" && <Link href={removeFilter("category")} className="rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">{selectedCategory} ×</Link>}
          {maxPrice && <Link href={removeFilter("maxPrice")} className="rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">Up to ${maxPrice} ×</Link>}
          {maxDuration && <Link href={removeFilter("maxDuration")} className="rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">Up to {maxDuration >= 240 ? maxDuration === 480 ? "full day" : "half day" : `${maxDuration / 60} hr`} ×</Link>}
        </div>

        <div className="mt-8 flex items-end justify-between gap-5">
          <div>
            <p className="text-sm text-[#6c7d74]">{filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} found</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{query ? `Results for “${query}”` : selectedCategory}</h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center"><SortSelect value={sort} />{(query || selectedCategory !== "All services" || maxPrice || maxDuration || location !== "Issaquah, WA" || radius !== 10) && <Link href="/services" className="text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4">Clear filters</Link>}</div>
        </div>

        {filteredServices.length > 0 ? (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <article key={service.slug} className="group relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,49,38,.12)]">
                <Link href={`/services/${service.slug}`} className="block">
                <div role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-56 overflow-hidden bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${getServiceVisual(service.category).gradient}`}`}>
                  {!service.imageUrls[0] && <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />}
                  <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold backdrop-blur">New listing</span>
                  {!service.imageUrls[0] && <span className="absolute bottom-5 right-6 text-6xl opacity-80">{getServiceVisual(service.category).art}</span>}
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-[#5f7568]">📍 {service.city}, {service.state}{typeof service.distanceMiles === "number" ? ` · ${service.distanceMiles < 0.1 ? "Nearby" : `${service.distanceMiles.toFixed(1)} mi`}` : ""}</span><span className="shrink-0 font-bold">From ${service.price}</span></div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[.13em] text-[#75847c]">{service.category}</p>
                  <h3 className="mt-1 text-xl font-bold tracking-[-.025em]">{service.title}</h3>
                  <p className="mt-2 text-sm text-[#6a7a72]">by {service.provider}</p>
                </div>
                </Link>
                <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-16 text-center">
            <span className="text-4xl">🔎</span>
            <h3 className="mt-4 text-xl font-bold">No exact matches yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">Try a broader search or explore all services. We&apos;re adding more local providers soon.</p>
            <Link href="/services" className="mt-6 inline-block rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">View all services</Link>
          </div>
        )}
      </section>
    </main>
  );
}
