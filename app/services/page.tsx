import BrandLockup from "@/components/brand-lockup";
import type { Metadata } from "next";
import Link from "next/link";
import { getServices, getServiceVisual } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import { FEATURED_SERVICE_CATEGORIES, SERVICE_CATEGORIES, SERVICE_CATEGORY_ICONS } from "@/lib/service-categories";
import LocationFilter from "@/components/location-filter";
import SortSelect from "@/components/sort-select";
import ServiceFiltersMenu from "@/components/service-filters-menu";
import { getContextualLocation } from "@/lib/request-location";
import ServiceDemandCapture from "@/components/service-demand-capture";
import MobileSiteNav from "@/components/mobile-site-nav";
import SearchResultsAnalytics from "@/components/search-results-analytics";
import ServiceSearchAssist from "@/components/service-search-assist";
import UiIcon from "@/components/ui-icon";
import { deliveryLabel, type ServiceDeliveryType } from "@/lib/service-delivery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore local and remote services",
  description: "Search in-person and remote service providers, compare details, and request bookings across the United States.",
  alternates: { canonical: "/services" },
};

const quickCategories = ["All services", ...FEATURED_SERVICE_CATEGORIES];
const resultsAnchor = "#service-listings";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const params = await searchParams;
  const showFilters = getParam(params.showFilters) === "1";
  const query = getParam(params.q).trim();
  const selectedCategory = getParam(params.category) || "All services";
  const requestedDelivery = getParam(params.delivery).toUpperCase();
  const delivery: "ALL" | ServiceDeliveryType = requestedDelivery === "IN_PERSON" || requestedDelivery === "REMOTE" || requestedDelivery === "BOTH" ? requestedDelivery : "ALL";
  const requestedLocation = getParam(params.location);
  const location = await getContextualLocation(requestedLocation);
  const requestedRadius = Number(getParam(params.radius));
  const radius = Number.isInteger(requestedRadius) && requestedRadius >= 1 && requestedRadius <= 250 ? requestedRadius : 25;
  const maxPrice = Number(getParam(params.maxPrice)) || undefined;
  const maxDuration = Number(getParam(params.maxDuration)) || undefined;
  const requestedSort = getParam(params.sort);
  const sort = delivery === "REMOTE" && requestedSort === "nearest" ? "newest" : requestedSort || (delivery === "REMOTE" ? "newest" : "nearest");
  const filteredServices = await getServices({ query, category: selectedCategory, delivery, ...(delivery !== "REMOTE" && location ? { location, radiusMiles: radius } : {}), maxPrice, maxDuration, sort });
  if (sort === "price-low") filteredServices.sort((left, right) => left.price - right.price);
  else if (sort === "price-high") filteredServices.sort((left, right) => right.price - left.price);
  else if (sort === "nearest") filteredServices.sort((left, right) => Number(left.distanceMiles === undefined) - Number(right.distanceMiles === undefined) || (left.distanceMiles ?? 0) - (right.distanceMiles ?? 0));

  function serviceHref(category: string) {
    const queryString = new URLSearchParams();
    if (query) queryString.set("q", query);
    if (category !== "All services") queryString.set("category", category);
    if (delivery !== "ALL") queryString.set("delivery", delivery);
    if (location && delivery !== "REMOTE") queryString.set("location", location);
    queryString.set("radius", String(radius));
    if (maxPrice) queryString.set("maxPrice", String(maxPrice));
    if (maxDuration) queryString.set("maxDuration", String(maxDuration));
    if (sort !== "nearest") queryString.set("sort", sort);
    return `/services?${queryString.toString()}${resultsAnchor}`;
  }

  function removeFilter(name: "location" | "radius" | "category" | "delivery" | "maxPrice" | "maxDuration") {
    const queryString = new URLSearchParams();
    if (query) queryString.set("q", query);
    if (selectedCategory !== "All services" && name !== "category") queryString.set("category", selectedCategory);
    if (delivery !== "ALL" && name !== "delivery") queryString.set("delivery", delivery);
    if (name !== "location" && location) queryString.set("location", location);
    queryString.set("radius", String(name === "radius" || name === "location" ? 25 : radius));
    if (maxPrice && name !== "maxPrice") queryString.set("maxPrice", String(maxPrice));
    if (maxDuration && name !== "maxDuration") queryString.set("maxDuration", String(maxDuration));
    if (sort !== "nearest") queryString.set("sort", sort);
    return `/services?${queryString.toString()}${resultsAnchor}`;
  }

  const currentResultsPath = serviceHref(selectedCategory);
  const clearFiltersParams = new URLSearchParams({ radius: String(radius) });
  if (location && delivery !== "REMOTE") clearFiltersParams.set("location", location);
  const clearFiltersHref = `/services?${clearFiltersParams.toString()}${resultsAnchor}`;
  const widerSearchParams = new URLSearchParams(clearFiltersParams);
  widerSearchParams.set("radius", String(Math.max(radius, 50)));
  if (query) widerSearchParams.set("q", query);
  if (selectedCategory !== "All services") widerSearchParams.set("category", selectedCategory);

  return (
    <main className="services-page min-h-screen bg-[#f8f7f3] text-[#183126]">
      <SearchResultsAnalytics query={query} category={selectedCategory} delivery={delivery} location={location} radiusMiles={radius} resultCount={filteredServices.length} />
      <header className="relative z-50 border-b border-[#183126]/10 bg-[#f8f7f3]/90 backdrop-blur">
        <div className="site-container-wide flex items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:gap-2.5 sm:text-2xl">
            <BrandLockup />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex"><Link href="/guides" className="site-nav-link">Guides</Link><Link href="/pricing" className="site-nav-link">Pricing</Link></nav>
            <Link href="/pricing" className="hidden min-h-10 items-center justify-center rounded-full px-2.5 py-2 text-xs font-bold hover:bg-[#183126]/5 min-[430px]:inline-flex sm:px-3 sm:text-sm lg:hidden">Pricing</Link>
            <Link href="/providers/join" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:block">List your service</Link>
            <MobileSiteNav />
            <AccountNav />
          </div>
        </div>
      </header>

      <section style={{ animation: "none" }} className="services-hero relative z-40 border-b border-[#183126]/10">
        <div className="site-container-wide px-4 py-9 sm:px-8 sm:py-16">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#64776d] transition hover:text-[#183126]"><UiIcon name="arrow-left" className="h-4 w-4" />Home</Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">{delivery === "REMOTE" ? "Work with providers online" : location ? "Explore nearby" : "Explore services"}</p>
          <h1 className="type-page-title mt-2">Find the right help for the job.</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#5d7066]">{delivery === "REMOTE" ? "Compare remote providers, prices, and availability without a distance limit." : location ? `Compare local and online providers around ${location}.` : "Browse services available locally or online."}</p>

          <form action={`/services${resultsAnchor}`} className="services-search-panel relative z-30 mt-8 flex max-w-5xl flex-col gap-2 rounded-3xl border border-[#183126]/10 bg-white p-2.5 sm:flex-row sm:items-center sm:rounded-full">
            <ServiceSearchAssist id="services-service-search" defaultValue={query} placeholder="Try “cleaning” or “lawn care”" label="Search services" className="services-search-query flex flex-1 items-center gap-3 px-5 py-3" inputClassName="services-search-query-input w-full bg-transparent text-sm outline-none placeholder:text-[#8a9790]" icon="🔎" />
            {delivery !== "REMOTE" ? <div className="services-search-location border-t border-[#183126]/10 sm:min-w-[350px] sm:border-l sm:border-t-0"><LocationFilter initialLocation={location} initialRadius={radius} restoreRemembered={!requestedLocation} autoSubmitLocation autoSubmitRadius requestLocationOnFirstVisit /></div> : <div className="flex min-h-12 items-center rounded-full bg-[#edf3e7] px-5 text-sm font-bold text-[#4f695a]">🌐 Available online</div>}
            {delivery !== "ALL" && <input type="hidden" name="delivery" value={delivery} />}
            {selectedCategory !== "All services" && <input type="hidden" name="category" value={selectedCategory} />}
            {maxPrice && <input type="hidden" name="maxPrice" value={maxPrice} />}
            {maxDuration && <input type="hidden" name="maxDuration" value={maxDuration} />}
            {sort !== "nearest" && <input type="hidden" name="sort" value={sort} />}
            <button type="submit" className="rounded-full bg-[#eee25a] px-7 py-3.5 text-sm font-bold transition hover:bg-[#f5ea6b]">Search</button>
          </form>
        </div>
      </section>

      <section id="all-filters" style={{ animation: "none" }} className="site-container-wide relative z-0 scroll-mt-6 px-4 py-9 sm:px-8 sm:py-14">
        <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Service delivery filter">{(["ALL", "IN_PERSON", "REMOTE"] as const).map((value) => { const next = new URLSearchParams(); if (query) next.set("q", query); if (selectedCategory !== "All services") next.set("category", selectedCategory); if (value !== "ALL") next.set("delivery", value); if (location && value !== "REMOTE") next.set("location", location); if (value !== "REMOTE") next.set("radius", String(radius)); return <Link key={value} href={`/services?${next.toString()}${resultsAnchor}`} aria-current={delivery === value ? "page" : undefined} className={`min-h-11 rounded-full border px-5 py-3 text-sm font-bold ${delivery === value ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/12 bg-white"}`}>{value === "ALL" ? "All services" : deliveryLabel(value)}</Link>; })}</div>
        <div className="flex min-w-0 items-start gap-2">
          <div className="mobile-scroll-row -ml-4 flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto px-4 pb-3 sm:ml-0 sm:px-0">
            {quickCategories.map((category) => {
              const active = category === selectedCategory;
              return (
                <Link key={category} href={serviceHref(category)} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${active ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/12 bg-white hover:border-[#496958] hover:bg-[#edf3e7]"}`}>{category}</Link>
              );
            })}
          </div>
          <ServiceFiltersMenu initiallyOpen={showFilters}>
            <summary className="list-none rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-[#496958] hover:bg-[#edf3e7] [&::-webkit-details-marker]:hidden">More filters <span className="inline-block transition group-open:rotate-180">⌄</span></summary>
            <div className="fixed inset-x-3 bottom-3 z-[80] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_20px_55px_rgba(24,49,38,.15)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-8 sm:mt-3 sm:max-h-[min(40rem,calc(100dvh-7rem))] sm:w-[620px] sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">All categories</p>
              <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">{SERVICE_CATEGORIES.map((category) => <Link key={category} href={serviceHref(category)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition hover:bg-[#edf3e7] ${selectedCategory === category ? "border-[#183126] bg-[#edf3e7]" : "border-[#183126]/10"}`}><span className="shrink-0">{SERVICE_CATEGORY_ICONS[category] ?? "✨"}</span><span className="min-w-0 break-words">{category}</span></Link>)}</div>
              <form action={`/services${resultsAnchor}`} className="mt-6 grid gap-4 border-t border-[#183126]/10 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                {query && <input type="hidden" name="q" value={query} />}{location && delivery !== "REMOTE" && <input type="hidden" name="location" value={location} />}{delivery !== "REMOTE" && <input type="hidden" name="radius" value={radius} />}{delivery !== "ALL" && <input type="hidden" name="delivery" value={delivery} />}{selectedCategory !== "All services" && <input type="hidden" name="category" value={selectedCategory} />}{sort !== (delivery === "REMOTE" ? "newest" : "nearest") && <input type="hidden" name="sort" value={sort} />}
                <label><span className="mb-2 block text-xs font-bold">Maximum price</span><select name="maxPrice" defaultValue={maxPrice ?? ""} className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-3 py-3 text-sm outline-none"><option value="">Any price</option><option value="50">Up to $50</option><option value="100">Up to $100</option><option value="250">Up to $250</option><option value="500">Up to $500</option></select></label>
                <label><span className="mb-2 block text-xs font-bold">Maximum estimated time</span><select name="maxDuration" defaultValue={maxDuration ?? ""} className="w-full rounded-xl border border-[#183126]/15 bg-[#faf9f5] px-3 py-3 text-sm outline-none"><option value="">Any estimated time</option><option value="60">Up to 1 hour</option><option value="120">Up to 2 hours</option><option value="240">Up to half day</option><option value="480">Up to full day</option></select></label>
                <button type="submit" className="rounded-xl bg-[#eee25a] px-5 py-3 text-sm font-bold transition hover:bg-[#f5ea6b]">Apply filters</button>
              </form>
            </div>
          </ServiceFiltersMenu>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-[#718078]">Active filters</span>
          {location && delivery !== "REMOTE" && <Link href={removeFilter("location")} title="Reset location" className="inline-flex items-center gap-1.5 rounded-full bg-[#edf3e7] px-3 py-2 transition hover:bg-[#dce9d8]"><UiIcon name="map-pin" className="h-3.5 w-3.5" />{location}<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
          {location && delivery !== "REMOTE" && <Link href={removeFilter("radius")} title="Reset radius" className="inline-flex items-center gap-1.5 rounded-full bg-[#edf3e7] px-3 py-2 transition hover:bg-[#dce9d8]">Within {radius} mi<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
          {selectedCategory !== "All services" && <Link href={removeFilter("category")} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">{selectedCategory}<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
          {delivery !== "ALL" && <Link href={removeFilter("delivery")} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">{deliveryLabel(delivery)}<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
          {maxPrice && <Link href={removeFilter("maxPrice")} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">Up to ${maxPrice}<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
          {maxDuration && <Link href={removeFilter("maxDuration")} className="inline-flex items-center gap-1.5 rounded-full bg-[#fff5b8] px-3 py-2 transition hover:bg-[#f4e77d]">Est. up to {maxDuration >= 240 ? maxDuration === 480 ? "full day" : "half day" : `${maxDuration / 60} hr`}<UiIcon name="close" className="h-3.5 w-3.5" /></Link>}
        </div>

        <div id="service-listings" className="mt-8 flex scroll-mt-6 flex-col items-stretch gap-4 sm:scroll-mt-8 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p className="text-sm text-[#6c7d74]">{filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} found</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{query ? `Results for “${query}”` : selectedCategory}</h2>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2 sm:shrink-0 sm:flex-row sm:items-center"><SortSelect value={sort} remote={delivery === "REMOTE"} />{(query || selectedCategory !== "All services" || delivery !== "ALL" || maxPrice || maxDuration) && <Link href={clearFiltersHref} className="text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4">Clear filters</Link>}</div>
        </div>

        {filteredServices.length > 0 ? (
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3 min-[1536px]:grid-cols-4">
            {filteredServices.map((service) => (
              <article key={service.slug} className="marketplace-card group relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white transition">
                <Link href={`/services/${service.slug}?from=${encodeURIComponent(currentResultsPath)}`} className="block" aria-label={`View ${service.title}`}>
                <div role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-56 overflow-hidden bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${getServiceVisual(service.category).gradient}`}`}>
                  {!service.imageUrls[0] && <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />}
                  {!service.imageUrls[0] && <span className="absolute bottom-5 right-6 text-6xl opacity-80">{getServiceVisual(service.category).art}</span>}
                </div>
                </Link>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-[#5f7568]">{service.deliveryType === "REMOTE" ? "🌐 Remote" : service.deliveryType === "BOTH" ? "🌐 Remote or in person" : `📍 ${service.city}, ${service.state}${typeof service.distanceMiles === "number" ? ` · ${service.distanceMiles < 0.1 ? "Nearby" : `${service.distanceMiles.toFixed(1)} mi`}` : ""}`}</span><span className="shrink-0 font-bold">From ${service.price}</span></div>
                  <p className="mt-4 text-xs font-bold uppercase tracking-[.13em] text-[#75847c]">{service.category}</p>
                  <Link href={`/services/${service.slug}?from=${encodeURIComponent(currentResultsPath)}`}><h3 className="mt-1 text-xl font-bold tracking-[-.025em]">{service.title}</h3></Link>
                  <p className="mt-2 text-sm text-[#6a7a72]">by {service.providerProfileVisible ? <Link href={`/providers/${service.providerSlug}`} className="font-bold underline decoration-[#c7bb41] decoration-2 underline-offset-4">{service.provider}</Link> : <span className="font-bold">{service.provider}</span>}</p>
                </div>
                <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-16 text-center">
            <span className="text-4xl">🔎</span>
            <h3 className="mt-4 text-xl font-bold">No exact matches yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">{delivery === "REMOTE" ? "Try another service or request remote help so eligible online providers can send you a quote." : location ? `Adjust one part of your search while keeping ${location} as your area.` : "Try another service or choose your city to check nearby availability."}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={`/requests?${new URLSearchParams({ ...(selectedCategory !== "All services" ? { category: selectedCategory } : {}), title: query || (selectedCategory !== "All services" ? selectedCategory : delivery === "REMOTE" ? "Remote service request" : "Local service request"), delivery: delivery === "REMOTE" ? "REMOTE" : "IN_PERSON", ...(location && delivery !== "REMOTE" ? { location } : {}), radius: String(radius) }).toString()}`} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Request this service</Link>
              {location && radius < 50 && <Link href={`/services?${widerSearchParams.toString()}${resultsAnchor}`} className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Expand to 50 miles</Link>}
              {selectedCategory !== "All services" && <Link href={removeFilter("category")} className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Remove category</Link>}
              {query && <Link href={clearFiltersHref} className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Clear search</Link>}
              {location && !query && selectedCategory === "All services" && radius >= 50 && <Link href={clearFiltersHref} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">View all nearby services</Link>}
            </div>
            {delivery !== "REMOTE" && location ? <ServiceDemandCapture query={query} category={selectedCategory} location={location} radiusMiles={radius} /> : delivery !== "REMOTE" ? <div className="mx-auto mt-8 max-w-xl rounded-2xl bg-[#eef3ea] p-5 text-sm text-[#5d7066]"><strong className="text-[#183126]">Choose your city to join the local availability list.</strong><p className="mt-1 leading-6">We use requested services by location to recruit providers where customers need them.</p></div> : null}
          </div>
        )}
      </section>
    </main>
  );
}
