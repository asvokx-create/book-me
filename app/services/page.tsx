import type { Metadata } from "next";
import Link from "next/link";
import { getServices, getServiceVisual } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore local services | BookMe",
  description: "Search trusted local service providers near Issaquah.",
};

const categories = ["All services", "Car detailing", "Lawn & garden", "Home cleaning", "Handyman", "Photography"];

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const selectedCategory = getParam(params.category) || "All services";
  const location = getParam(params.location) || "Issaquah, WA";
  const filteredServices = await getServices({ query, category: selectedCategory, location });

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            BookMe
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
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
            <label className="flex items-center gap-2 rounded-full border-t border-[#183126]/10 px-4 py-3 sm:min-w-[185px] sm:border-l sm:border-t-0"><span aria-hidden="true">📍</span><span className="sr-only">Location</span><input name="location" defaultValue={location} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
            {selectedCategory !== "All services" && <input type="hidden" name="category" value={selectedCategory} />}
            <button type="submit" className="rounded-full bg-[#eee25a] px-7 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Search</button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex gap-2 overflow-x-auto pb-3">
          {categories.map((category) => {
            const active = category === selectedCategory;
            const queryString = new URLSearchParams();
            if (query) queryString.set("q", query);
            if (category !== "All services") queryString.set("category", category);
            queryString.set("location", location);
            return (
              <Link key={category} href={`/services?${queryString.toString()}`} className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${active ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/12 bg-white hover:border-[#496958]"}`}>{category}</Link>
            );
          })}
        </div>

        <div className="mt-8 flex items-end justify-between gap-5">
          <div>
            <p className="text-sm text-[#6c7d74]">{filteredServices.length} {filteredServices.length === 1 ? "service" : "services"} found</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">{query ? `Results for “${query}”` : selectedCategory}</h2>
          </div>
          {(query || selectedCategory !== "All services") && <Link href="/services" className="text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4">Clear filters</Link>}
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
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold text-[#5f7568]">📍 {service.city}, {service.state}</span><span className="font-bold">From ${service.price}</span></div>
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
