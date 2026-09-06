import Link from "next/link";
import { getServices, getServiceVisual, type ServiceListing } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import { FEATURED_SERVICE_CATEGORIES } from "@/lib/service-categories";
import LocationFilter from "@/components/location-filter";
import ServiceCategoryIcon from "@/components/service-category-icon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [services, allServices] = await Promise.all([
    getServices({ location: "Issaquah, WA", limit: 3 }),
    getServices({ limit: 50 }),
  ]);
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f3] text-[#183126]">
      <header className="relative z-20 border-b border-[#183126]/10 bg-[#f8f7f3]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-5">
          <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:gap-2.5 sm:text-2xl">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            <span className="hidden min-[390px]:inline">BubsBookings</span><span className="min-[390px]:hidden">Bubs</span>
          </h1>

          <div className="flex items-center gap-3">
            <Link href="/pricing" className="hidden rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-[#183126]/5 md:block">Pricing</Link>
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
        </div>

        <form action="/services" className="mt-9 flex max-w-4xl flex-col gap-2 rounded-3xl border border-[#183126]/10 bg-white p-2.5 shadow-[0_18px_50px_rgba(24,49,38,.13)] md:flex-row md:rounded-full">
          <div className="flex flex-1 items-center rounded-full px-4">
            <span className="mr-3 text-lg">🔎</span>

            <input
              name="q"
              type="text"
              placeholder="What service do you need?"
              className="w-full py-4 outline-none"
            />
          </div>

          <div className="md:min-w-[330px]"><LocationFilter restoreRemembered /></div>

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
          {FEATURED_SERVICE_CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/services?category=${encodeURIComponent(category)}`}
              className="group relative overflow-hidden rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 text-left shadow-[0_4px_20px_rgba(24,49,38,.04)] transition duration-300 hover:-translate-y-1.5 hover:border-[#4f765f]/25 hover:bg-[#fbfcf8] hover:shadow-[0_18px_36px_rgba(24,49,38,.12)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#eee25a]/60"
            >
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#e7efe3]/60 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
              <ServiceCategoryIcon category={category} />
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="font-bold tracking-[-.01em]">{category}</p>
                <span aria-hidden="true" className="grid h-8 w-8 translate-x-2 place-items-center rounded-full bg-[#183126] text-sm text-white opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
        <div className="mb-7 flex items-end justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Local marketplace</p><h3 className="mt-2 text-3xl font-bold tracking-[-.04em]">New near Issaquah</h3></div>

          <Link href="/services" className="text-sm font-medium hover:underline">
            View all
          </Link>
        </div>

        {services.length > 0 ? <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => <HomeServiceCard key={service.id} service={service} badge="New listing" />)}
        </div> : <div className="rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-14 text-center"><span className="text-4xl">🌱</span><h4 className="mt-4 text-xl font-bold">Local services are coming soon</h4><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">Be the first local professional to create a real BubsBookings listing.</p><Link href="/providers/join" className="mt-6 inline-block rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">List your service</Link></div>}
      </section>

      {allServices.length > 0 && <section className="border-t border-[#183126]/10 bg-[#f1f3ed]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Browse the marketplace</p><h3 className="mt-2 text-3xl font-bold tracking-[-.04em]">All listings</h3><p className="mt-2 text-sm text-[#687970]">Explore every active service currently available on BubsBookings.</p></div>
            <Link href="/services#service-listings" className="shrink-0 rounded-full bg-white px-5 py-3 text-sm font-bold shadow-sm transition hover:bg-[#eee25a]">Explore all →</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {allServices.map((service) => <HomeServiceCard key={service.id} service={service} />)}
          </div>
        </div>
      </section>}
    </main>
  );
}

function HomeServiceCard({ service, badge }: { service: ServiceListing; badge?: string }) {
  const visual = getServiceVisual(service.category);
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
        <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><span>📍</span><span>{service.city}, {service.state}</span></div>
      </div>
    </Link>
    <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
  </article>;
}
