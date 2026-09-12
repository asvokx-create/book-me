import Link from "next/link";
import type { Metadata } from "next";
import { getServices, getServiceVisual, type ServiceListing } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import { FEATURED_SERVICE_CATEGORIES } from "@/lib/service-categories";
import LocationFilter from "@/components/location-filter";
import ServiceCategoryIcon from "@/components/service-category-icon";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const location = getParam(params.location) || "Issaquah, WA";
  const requestedRadius = Number(getParam(params.radius));
  const radius = Number.isInteger(requestedRadius) && requestedRadius >= 1 && requestedRadius <= 250 ? requestedRadius : 25;
  const city = location.split(",")[0]?.trim() || location;
  const servicesWithinRange = await getServices({ location, radiusMiles: radius, limit: 50 });
  const featuredServices = servicesWithinRange.slice(0, 3);
  const categoryCounts = new Map(FEATURED_SERVICE_CATEGORIES.map((category) => [category, servicesWithinRange.filter((service) => service.category === category).length]));
  const homeCategories = [...FEATURED_SERVICE_CATEGORIES].sort((left, right) => (categoryCounts.get(right) ?? 0) - (categoryCounts.get(left) ?? 0));
  const nearbyParams = new URLSearchParams({ location, radius: String(radius) });
  const nearbyServicesHref = `/services?${nearbyParams.toString()}#service-listings`;
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f3] text-[#183126]">
      <header className="sticky top-0 z-50 border-b border-white/70 bg-[#f8f7f3]/82 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:gap-2.5 sm:text-2xl">
            <span className="grid h-10 w-10 place-items-center rounded-[.9rem] bg-[#173d2e] text-base text-[#f1e45c] shadow-[0_8px_20px_rgba(23,61,46,.2)]">B</span>
            <span className="hidden min-[390px]:inline">BubsBookings</span><span className="min-[390px]:hidden">Bubs</span>
          </h1>

          <div className="flex items-center gap-3">
            <Link href="/pricing" className="rounded-xl px-2 py-2 text-xs font-semibold transition hover:bg-[#183126]/5 sm:px-4 sm:text-sm"><span className="sm:hidden">Pricing</span><span className="hidden sm:inline">Provider pricing</span></Link>
            <Link href="/providers/join" className="hidden rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-[#183126]/5 sm:block">
              List your service
            </Link>
            <AccountNav />
          </div>
        </div>
      </header>

      <section className="relative z-10 isolate">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"><div className="absolute -right-48 top-8 h-[620px] w-[620px] rounded-full bg-[#d8e7d3] blur-2xl sm:right-[-8rem] sm:top-4" /></div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.65fr] lg:gap-14">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#183126]/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4d6b59] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#69a67e]" /> Trusted help, right nearby
          </p>

          <h2 className="text-[clamp(2.6rem,8vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.05em]">
            Your to-do list just got <span className="underline decoration-[#eee25a] decoration-[10px] underline-offset-[-4px]">a lot lighter.</span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5a6d63]">
            Discover trusted local pros, compare your options, and book the right help—all in one simple place.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#4e675a]">
            <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#dfeade] text-[11px]">✓</span>Local professionals</span>
            <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#dfeade] text-[11px]">✓</span>Secure payments</span>
            <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#dfeade] text-[11px]">✓</span>Real booking support</span>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="absolute -inset-8 rounded-full bg-[#bcd6b8]/35 blur-3xl" />
          <Link href={nearbyServicesHref} aria-label={`Browse services near ${city}`} className="relative block rotate-[2deg] rounded-[2.25rem] border border-white/80 bg-white/88 p-5 shadow-[0_30px_80px_rgba(24,49,38,.18)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_34px_85px_rgba(24,49,38,.22)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]">
            <div className="relative h-56 overflow-hidden rounded-[1.65rem] bg-gradient-to-br from-[#143d2c] via-[#2f7652] to-[#b8dc62]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,.4),transparent_27%)]" />
              <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold">Popular nearby</span>
              <span className="absolute bottom-4 right-5 text-6xl drop-shadow-lg">🧰</span>
            </div>
            <div className="px-1 pb-1 pt-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-lg font-bold">Help is closer than you think</p><p className="mt-1 text-sm text-[#65766d]">Compare, message, and book in one place.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f1e45c] text-lg">→</span></div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-[#f3f5f0] px-2 py-3"><p className="font-black">Local</p><p className="mt-0.5 text-[10px] text-[#6a7b72]">Search by area</p></div><div className="rounded-2xl bg-[#f3f5f0] px-2 py-3"><p className="font-black">Direct</p><p className="mt-0.5 text-[10px] text-[#6a7b72]">Chat with pros</p></div><div className="rounded-2xl bg-[#f3f5f0] px-2 py-3"><p className="font-black">Secure</p><p className="mt-0.5 text-[10px] text-[#6a7b72]">Pay with Stripe</p></div></div>
            </div>
          </Link>
          <div className="absolute -bottom-5 -left-8 rounded-2xl border border-white bg-[#173d2e] px-4 py-3 text-white shadow-xl"><p className="text-xs font-bold text-[#bdd0c4]">BUILT FOR YOUR NEIGHBORHOOD</p><p className="mt-1 text-sm font-bold">Trusted help, without the hassle.</p></div>
        </div>
        </div>

        <form action="/services" className="mt-12 flex max-w-5xl flex-col gap-2 rounded-3xl border border-white bg-white/92 p-2.5 shadow-[0_24px_65px_rgba(24,49,38,.16)] backdrop-blur-xl md:flex-row md:rounded-full">
          <div className="flex flex-1 items-center rounded-full px-4">
            <span className="mr-3 text-lg">🔎</span>

            <input
              name="q"
              type="text"
              placeholder="What service do you need?"
              className="w-full py-4 outline-none"
            />
          </div>

          <div className="md:min-w-[330px]"><LocationFilter initialLocation={location} initialRadius={radius} restoreRemembered={!getParam(params.location)} autoSubmitLocation autoSubmitRadius requestLocationOnFirstVisit /></div>

          <button type="submit" className="rounded-full bg-[#eee25a] px-7 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">
            Find a pro
          </button>
        </form>
        </div>
      </section>

      <section className="relative z-0 mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Explore nearby</p>
        <div className="mb-7 mt-2 flex items-end justify-between gap-4"><h3 className="text-3xl font-bold tracking-[-.04em]">What can we take off your plate?</h3><Link href="/services?showFilters=1#all-filters" className="shrink-0 rounded-full px-4 py-2 text-sm font-bold transition hover:bg-[#eee25a]">View all</Link></div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {homeCategories.map((category) => {
            const count = categoryCounts.get(category) ?? 0;
            const card = <>
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#e7efe3]/60 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
              <ServiceCategoryIcon category={category} />
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="font-bold tracking-[-.01em]">{category}</p>
                {count > 0 && <span aria-hidden="true" className="grid h-8 w-8 translate-x-2 place-items-center rounded-full bg-[#183126] text-sm text-white opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">→</span>}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#718078]">{count > 0 ? `${count} active ${count === 1 ? "listing" : "listings"}` : "Providers coming soon"}</p>
            </>;
            return count > 0 ? <Link key={category} href={`/services?category=${encodeURIComponent(category)}&location=${encodeURIComponent(location)}&radius=${radius}#service-listings`} className="group relative overflow-hidden rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 text-left shadow-[0_4px_20px_rgba(24,49,38,.04)] transition duration-300 hover:-translate-y-1.5 hover:border-[#4f765f]/25 hover:bg-[#fbfcf8] hover:shadow-[0_18px_36px_rgba(24,49,38,.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/60">{card}</Link> : <div key={category} className="group relative overflow-hidden rounded-[1.75rem] border border-dashed border-[#183126]/10 bg-white/55 p-5 text-left">{card}</div>;
          })}
        </div>
      </section>

      <section id="nearby-listings" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Local marketplace</p><h3 className="mt-2 text-3xl font-bold tracking-[-.04em]">Services near {city}</h3><p className="mt-2 text-sm text-[#687970]">A quick look at nearby options within {radius} miles.</p></div>

          <Link href={nearbyServicesHref} className="shrink-0 rounded-full border border-[#183126]/12 bg-white px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-[#eee25a]">
            View all services →
          </Link>
        </div>

        {featuredServices.length > 0 ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featuredServices.map((service) => <HomeServiceCard key={service.id} service={service} />)}
        </div> : <div className="rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-12 text-center"><span className="text-4xl">🌱</span><h4 className="mt-4 text-xl font-bold">Local services are coming soon</h4><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">Try a wider search or become one of the first providers near {city}.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href={`/services?location=${encodeURIComponent(location)}&radius=${Math.min(250, Math.max(50, radius))}#service-listings`} className="rounded-full border border-[#183126]/12 px-5 py-3 text-sm font-bold">Widen search</Link><Link href="/providers/join" className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">List your service</Link></div></div>}
      </section>

      <section className="mt-5 bg-[#173d2e] text-white">
        <div className="mx-auto grid max-w-6xl items-stretch gap-3 px-4 py-6 sm:px-6 md:grid-cols-2">
          <Link href="/promise" className="group rounded-2xl border border-white/12 bg-white/7 p-5 transition hover:bg-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#bfd0c6]">☂️ The BubsBookings Promise</p>
            <h3 className="mt-1.5 text-xl font-bold tracking-[-.03em]">Book with more confidence.</h3>
            <p className="mt-2 text-xs leading-5 text-[#c8d7cf]">Clear provider information, secure payments, and booking support.</p>
            <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#f1e45c]">Learn how you’re covered <span className="transition group-hover:translate-x-1">→</span></span>
          </Link>

          <div className="rounded-2xl bg-[#f3ed74] p-5 text-[#183126]">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#627065]">🧰 For local businesses</p>
            <h3 className="mt-1.5 text-xl font-bold tracking-[-.03em]">Turn local searches into bookings.</h3>
            <p className="mt-2 text-xs leading-5 text-[#52655a]">Publish services, organize your team, and manage requests.</p>
            <Link href="/pricing" className="mt-3 inline-flex rounded-full border border-[#183126]/20 bg-white/45 px-3.5 py-2 text-xs font-bold transition hover:bg-white/70">Provider pricing →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function HomeServiceCard({ service, badge }: { service: ServiceListing; badge?: string }) {
  const visual = getServiceVisual(service.category);
  const distanceLabel = typeof service.distanceMiles === "number"
    ? service.distanceMiles < 0.1 ? "In your city" : `${service.distanceMiles.toFixed(1)} mi away`
    : "";
  return <article className="group relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,49,38,.12)]">
    <Link href={`/services/${service.slug}`} className="block">
      <div role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-56 overflow-hidden bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>
        {!service.imageUrls[0] && <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />}
        {badge && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold backdrop-blur">{badge}</span>}
        {!service.imageUrls[0] && <span className="absolute bottom-5 right-6 text-6xl opacity-80 transition duration-300 group-hover:scale-105">{visual.art}</span>}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><h4 className="truncate text-lg font-semibold">{service.title}</h4><p className="mt-1 truncate text-sm text-zinc-500">{service.provider}</p></div>
          <div className="shrink-0 text-right"><p className="font-bold">${service.price}</p><p className="text-xs text-zinc-500">starting</p></div>
        </div>
        <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><span>📍</span><span>{service.city}, {service.state}{distanceLabel && ` · ${distanceLabel}`}</span></div>
      </div>
    </Link>
    <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
  </article>;
}
