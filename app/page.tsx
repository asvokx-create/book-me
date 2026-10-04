import BrandLockup from "@/components/brand-lockup";
import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { getServices, getServiceVisual, type ServiceListing } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import { FEATURED_SERVICE_CATEGORIES } from "@/lib/service-categories";
import ServiceCategoryIcon from "@/components/service-category-icon";
import UpcomingCategoryCard from "@/components/upcoming-category-card";
import { getContextualLocation } from "@/lib/request-location";
import MobileSiteNav from "@/components/mobile-site-nav";
import HomeHeroPreview from "@/components/home-hero-preview";
import HomeServiceSearch from "@/components/home-service-search";
import UiIcon from "@/components/ui-icon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find and book local or remote services", description: "Compare in-person and remote service listings, message providers, and request bookings across the United States.", alternates: { canonical: "/" } };

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const requestedLocation = getParam(params.location);
  const requestedDelivery = getParam(params.delivery).toUpperCase();
  const initialDelivery = requestedDelivery === "REMOTE" || requestedDelivery === "IN_PERSON" ? requestedDelivery : "ALL";
  const location = await getContextualLocation(requestedLocation);
  const requestedRadius = Number(getParam(params.radius));
  const radius = Number.isInteger(requestedRadius) && requestedRadius >= 1 && requestedRadius <= 250 ? requestedRadius : 25;
  const [cityPart, statePart] = location.split(",");
  const city = cityPart?.trim() || "";
  const state = statePart?.trim() || "";
  const servicesWithinRange = await getServices(location ? { location, radiusMiles: radius, limit: 50 } : { limit: 50 });
  const cityServices = location ? servicesWithinRange.filter((service) =>
    service.deliveryType !== "REMOTE" && service.city.trim().toLowerCase() === city.toLowerCase()
      && (!state || service.state.trim().toLowerCase() === state.toLowerCase()),
  ) : [];
  const cityServiceIds = new Set(cityServices.map((service) => service.id));
  const otherServices = servicesWithinRange.filter((service) => !cityServiceIds.has(service.id));
  const categoryCounts = new Map(FEATURED_SERVICE_CATEGORIES.map((category) => [category, servicesWithinRange.filter((service) => service.category === category).length]));
  const populatedCategories = FEATURED_SERVICE_CATEGORIES
    .filter((category) => (categoryCounts.get(category) ?? 0) > 0)
    .sort((left, right) => (categoryCounts.get(right) ?? 0) - (categoryCounts.get(left) ?? 0));
  const upcomingCategories = FEATURED_SERVICE_CATEGORIES.filter((category) => (categoryCounts.get(category) ?? 0) === 0);
  const nearbyParams = new URLSearchParams({ radius: String(radius) });
  if (location) nearbyParams.set("location", location);
  const nearbyServicesHref = `/services?${nearbyParams.toString()}#service-listings`;
  const requestParams = new URLSearchParams({ radius: String(radius) });
  if (location) requestParams.set("location", location);
  const requestHref = `/requests?${requestParams.toString()}`;
  return (
    <main className="home-page min-h-screen overflow-x-clip bg-[#f8f7f3] text-[#183126]">
      <header className="home-header sticky top-0 z-50 border-b border-white/70 bg-[#f8f7f3]/82 backdrop-blur-xl">
        <div className="narrow-mobile-header site-container flex items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
          <Link href="/" aria-label="BubsBookings home" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <BrandLockup priority />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
              <Link href="/services" className="site-nav-link">Find services</Link>
              <Link href="/guides" className="site-nav-link">Guides</Link>
              <Link href="/pricing" className="site-nav-link">Pricing</Link>
            </nav>
            <Link href="/providers/join" className="home-header-provider-link hidden rounded-full border border-[#183126]/10 bg-white/60 px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:border-[#183126]/20 hover:bg-white sm:block">
              List your service
            </Link>
            <MobileSiteNav />
            <div className="home-header-account"><AccountNav /></div>
          </div>
        </div>
      </header>

      <section className="home-hero relative z-10 isolate">
        <div className="site-container relative z-10 px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.65fr] lg:gap-14">
        <div className="max-w-3xl">
          <p className="home-hero-eyebrow mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#4d6b59]">Local and remote service marketplace</p>

          <h1 className="type-hero">
            Find the right provider for the work you need.
          </h1>

          <p className="home-hero-copy mt-6 max-w-2xl text-lg leading-8 text-[#5a6d63]">
            Search active listings, compare provider details and starting prices, then message or request a booking through BubsBookings.
          </p>
          <div className="home-hero-points mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#4e675a]">
            <span className="flex items-center gap-2"><UiIcon name="map-pin" className="h-4 w-4 text-[#2f6b4b]" />Local and remote listings</span>
            <span className="flex items-center gap-2"><UiIcon name="card" className="h-4 w-4 text-[#2f6b4b]" />Stripe-powered payments</span>
            <span className="flex items-center gap-2"><UiIcon name="messages" className="h-4 w-4 text-[#2f6b4b]" />Booking support</span>
          </div>
        </div>

        <HomeHeroPreview href={nearbyServicesHref} city={city} hasLocation={Boolean(location)} />
        </div>

        <HomeServiceSearch initialDelivery={initialDelivery} initialLocation={location} initialRadius={radius} restoreRemembered={!requestedLocation} />
        <div className="home-request-banner relative z-0 mt-4 flex w-full max-w-6xl flex-col items-center justify-between gap-3 rounded-xl border border-[#183126]/10 bg-white px-5 py-4 text-center sm:flex-row sm:text-left"><div><p className="text-sm font-bold">Not sure which listing fits?</p><p className="mt-1 text-xs text-[#63756b]">Describe the job once and receive quotes from eligible providers.</p></div><Link href={requestHref} className="home-request-cta min-h-11 shrink-0 rounded-lg bg-[#183126] px-5 py-3 text-sm font-bold text-white">Request a service</Link></div>
        </div>
      </section>

      <section className="home-discovery site-container relative z-0 px-4 pb-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">{location ? "Explore nearby" : "Explore services"}</p>
        <div className="mb-7 mt-2 flex items-end justify-between gap-4"><h2 className="text-3xl font-bold tracking-[-.04em]">What can we take off your plate?</h2><Link href="/services?showFilters=1#all-filters" className="home-section-action shrink-0 rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a]">View all</Link></div>

        {populatedCategories.length > 0 ? <div className="home-category-grid grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {populatedCategories.map((category) => {
            const count = categoryCounts.get(category) ?? 0;
            const card = <>
              <ServiceCategoryIcon category={category} />
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="font-bold tracking-[-.01em]">{category}</p>
                {count > 0 && <UiIcon name="arrow-right" className="h-4 w-4 shrink-0 text-[#496756]" />}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#718078]">{count > 0 ? `${count} active ${count === 1 ? "listing" : "listings"}` : "Providers coming soon"}</p>
            </>;
            const categoryParams = new URLSearchParams({ category, radius: String(radius) });
            if (location) categoryParams.set("location", location);
            return <Link key={category} href={`/services?${categoryParams.toString()}#service-listings`} aria-label={count > 0 ? `Browse ${category}` : `Join the availability list for ${category}`} className={`home-category-card group relative overflow-hidden rounded-xl border p-5 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/60 ${count > 0 ? "border-[#183126]/10 bg-white transition hover:border-[#4f765f]/30 hover:bg-[#fbfcf8]" : "home-category-card--empty border-dashed border-[#183126]/14 bg-white/70 transition hover:border-[#6d8d78] hover:bg-white"}`}>{card}</Link>;
          })}
        </div> : <div className="rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-8 text-center"><p className="font-bold">Providers are joining this area</p><p className="mt-2 text-sm text-[#687970]">Request the service you need and we’ll use that demand to guide local provider recruiting.</p><Link href={requestHref} className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Request a service</Link></div>}
        {upcomingCategories.length > 0 && <div className="home-upcoming-panel mt-8 rounded-xl border border-[#183126]/12 bg-[#f5f7f2] p-4 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">More services coming soon</p><p className="mt-1 text-sm text-[#65766d]">Choose a category to browse current availability or submit a request.</p></div><Link href={requestHref} className="inline-flex min-h-11 items-center text-sm font-bold underline decoration-[#c7bb41] decoration-2 underline-offset-4">Request a service</Link></div><div className="home-upcoming-grid mt-4 grid gap-2">{upcomingCategories.map((category) => { const categoryParams = new URLSearchParams({ category, radius: String(radius) }); if (location) categoryParams.set("location", location); return <UpcomingCategoryCard key={category} category={category} href={`/services?${categoryParams.toString()}#service-listings`} />; })}</div></div>}
      </section>

      {location && <section id="nearby-listings" className="home-marketplace site-container scroll-mt-24 px-4 pb-2 sm:px-6 sm:pb-3">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Right in your city</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">Services in {city}</h2></div>
          <span className="shrink-0 rounded-full border border-[#183126]/10 bg-[#e8f0e4] px-4 py-2 text-xs font-bold text-[#496756]">{cityServices.length} {cityServices.length === 1 ? "local service" : "local services"}</span>
        </div>

        {cityServices.length > 0 ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-[1536px]:grid-cols-4">
          {cityServices.map((service) => <HomeServiceCard key={service.id} service={service} badge={`In ${city}`} />)}
        </div> : <div className="home-empty-state rounded-xl border border-[#183126]/10 bg-white px-6 py-12 text-center"><UiIcon name="map-pin" className="mx-auto h-8 w-8 text-[#496756]" /><h3 className="mt-4 text-xl font-bold">No services in {city} yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">You can still explore providers serving your area below, or become one of the first businesses listed in {city}.</p><Link href="/providers/join" className="mt-6 inline-flex rounded-lg bg-[#183126] px-5 py-3 text-sm font-bold text-white">List a service in {city}</Link></div>}
      </section>}

      <section className="home-all-services home-marketplace border-y border-[#183126]/8 bg-[#eef3ea]/70">
        <div className="site-container px-4 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-9">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">{location ? "More available to you" : "Current marketplace"}</p><h2 className="mt-2 text-3xl font-bold tracking-[-.04em]">All services</h2><p className="mt-2 text-sm text-[#687970]">{location ? `More local providers within ${radius} miles of ${city}, plus remote services available online.` : "Browse active local and remote listings across BubsBookings, or choose your city above for local results."}</p></div>
            <Link href={nearbyServicesHref} className="home-section-action shrink-0 rounded-full border border-[#183126]/12 bg-white px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-[#eee25a]">{location ? `Browse all within ${radius} miles` : "Browse all services"} →</Link>
          </div>

          {otherServices.length > 0 ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-[1536px]:grid-cols-4">
            {otherServices.map((service) => <HomeServiceCard key={service.id} service={service} />)}
          </div> : <div className="home-empty-state rounded-xl border border-[#183126]/10 bg-white px-6 py-10 text-center"><UiIcon name={location ? "check" : "services"} className="mx-auto h-8 w-8 text-[#496756]" /><h3 className="mt-3 text-lg font-bold">{location ? "That’s every service in your range" : "Listings are coming soon"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">{location ? `All available services within ${radius} miles are already listed in the ${city} section above.` : "Choose your city to check local availability or list your business as an early provider."}</p></div>}
        </div>
      </section>

      <section className="home-promo-strip mt-5 bg-[#173d2e] text-white">
        <div className="site-container grid items-stretch gap-3 px-4 py-6 sm:px-6 md:grid-cols-2">
          <Link href="/promise" className="home-promise-card group rounded-2xl border border-white/12 bg-white/7 p-5 transition hover:bg-white/10">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#bfd0c6]"><UiIcon name="shield" className="h-3.5 w-3.5" />The BubsBookings Promise</p>
            <h2 className="mt-1.5 text-xl font-bold tracking-[-.03em]">Book with more confidence.</h2>
            <p className="mt-2 text-xs leading-5 text-[#c8d7cf]">Clear provider information, Stripe payment tools, and booking support. Not insurance or a workmanship guarantee.</p>
            <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f1e45c]">Learn how you’re covered <span className="transition group-hover:translate-x-1">→</span></span>
          </Link>

          <div className="home-business-card rounded-2xl bg-[#f3ed74] p-5 text-[#183126]">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#627065]"><UiIcon name="share" className="h-3.5 w-3.5" />For creators &amp; affiliates</p>
            <h2 className="mt-1.5 text-xl font-bold tracking-[-.03em]">Share BubsBookings. Earn when providers succeed.</h2>
            <p className="mt-2 text-xs leading-5 text-[#52655a]">Refer real service providers and earn from eligible BubsBookings fee revenue after they complete qualifying paid work.</p>
            <Link href="/partners" className="mt-3 inline-flex rounded-full border border-[#183126]/20 bg-white/45 px-3.5 py-2 text-xs font-bold transition hover:bg-white/70">Become a Partner →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeServiceCard({ service, badge }: { service: ServiceListing; badge?: string }) {
  const visual = getServiceVisual(service.category);
  const businessHref = service.companySlug ? `/companies/${service.companySlug}` : service.providerProfileVisible ? `/providers/${service.providerSlug}` : null;
  const distanceLabel = typeof service.distanceMiles === "number"
    ? service.distanceMiles < 0.1 ? "In your city" : `${service.distanceMiles.toFixed(1)} mi away`
    : "";
  return <article className="home-service-card group relative overflow-hidden rounded-xl border border-[#183126]/10 bg-white transition hover:border-[#547562]/30">
    <Link href={`/services/${service.slug}`} className="block" aria-label={`View ${service.title}`}>
      <div role={service.imageUrls[0] ? undefined : "img"} aria-label={service.imageUrls[0] ? undefined : `${service.title} cover`} className={`relative h-56 overflow-hidden ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>
        {service.imageUrls[0] && <Image src={service.imageUrls[0]} alt={`${service.title} cover`} fill loading="lazy" unoptimized sizes="(max-width: 340px) calc(100vw - 32px), (max-width: 639px) 44vw, (max-width: 1023px) 50vw, (max-width: 1535px) 33vw, 25vw" className="object-cover" />}
        {(badge || service.deliveryType === "REMOTE") && <span className="home-preview-badge absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold backdrop-blur">{service.deliveryType === "REMOTE" ? "Available online" : badge}</span>}
        {!service.imageUrls[0] && <div className="absolute inset-0 grid place-items-center"><ServiceCategoryIcon category={service.category} className="h-24 min-h-24 w-24 min-w-24 [&_svg]:h-16 [&_svg]:w-16" /></div>}
      </div>
    </Link>
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-[#75847c]">{service.category}</p>
          <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><Link href={`/services/${service.slug}`}><h3 className="mt-1 truncate text-lg font-semibold">{service.title}</h3></Link><p className="mt-1 truncate text-sm text-zinc-500">Provider: {service.provider}</p>{businessHref && <Link href={businessHref} className="mt-2 inline-flex text-xs font-bold text-[#4f6d5a] underline underline-offset-4">View {service.companySlug ? "business" : "provider"} profile</Link>}</div>
          <div className="shrink-0 text-right"><p className="font-bold">${service.price}</p><p className="text-xs text-zinc-500">starting</p></div>
        </div>
        <div className="mt-5 flex items-start gap-2 text-sm text-zinc-500"><UiIcon name={service.deliveryType === "REMOTE" ? "globe" : "map-pin"} className="mt-0.5 h-4 w-4 shrink-0" /><span>{service.deliveryType === "REMOTE" ? "Remote · Available online" : `${service.city}, ${service.state}${distanceLabel && ` · ${distanceLabel}`}`}{service.deliveryType === "BOTH" && " · Remote available"}</span></div>
      </div>
    <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
  </article>;
}
