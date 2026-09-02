import Link from "next/link";
import { getServices, getServiceVisual } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";

export const dynamic = "force-dynamic";

const categories = [
  { name: "Car detailing", icon: "🚗" },
  { name: "Lawn & garden", icon: "🌿" },
  { name: "Home cleaning", icon: "🧽" },
  { name: "Handyman", icon: "🔨" },
  { name: "Photography", icon: "📷" },
];

export default async function Home() {
  const services = await getServices({ location: "Issaquah, WA", limit: 3 });
  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f3] text-[#183126]">
      <header className="relative z-20 border-b border-[#183126]/10 bg-[#f8f7f3]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            BookMe
          </h1>

          <div className="flex items-center gap-3">
            <Link href="/providers/join" className="hidden rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-[#183126]/5 sm:block">
              List your service
            </Link>
            <AccountNav />
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden">
        <div className="pointer-events-none absolute -right-48 top-8 -z-10 h-[620px] w-[620px] rounded-full bg-[#d8e7d3] blur-2xl sm:right-[-8rem] sm:top-4" />
        <div className="relative z-10 mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#183126]/10 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4d6b59] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#69a67e]" /> Trusted help, right nearby
          </p>

          <h2 className="text-5xl font-bold leading-[1.04] tracking-[-0.05em] sm:text-6xl">
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

          <label className="flex items-center rounded-full px-5 py-4 text-left md:min-w-[190px]">
            <span className="mr-2">📍</span>
            <input name="location" defaultValue="Issaquah, WA" aria-label="Location" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>

          <button type="submit" className="rounded-full bg-[#eee25a] px-7 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">
            Find a pro
          </button>
        </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Explore nearby</p>
        <h3 className="mb-7 mt-2 text-3xl font-bold tracking-[-.04em]">What can we take off your plate?</h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/services?category=${encodeURIComponent(category.name)}`}
              className="rounded-3xl border border-[#183126]/10 bg-white p-5 text-left shadow-[0_4px_20px_rgba(24,49,38,.04)] transition hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(24,49,38,.1)]"
            >
              <div className="mb-4 text-3xl">{category.icon}</div>

              <p className="font-semibold">{category.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-7 flex items-end justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#6b7c73]">Local marketplace</p><h3 className="mt-2 text-3xl font-bold tracking-[-.04em]">New near Issaquah</h3></div>

          <Link href="/services" className="text-sm font-medium hover:underline">
            View all
          </Link>
        </div>

        {services.length > 0 ? <div className="grid gap-6 md:grid-cols-3">
          {services.map((service) => {
            const visual = getServiceVisual(service.category);
            return (
            <article
              key={service.slug}
              className="relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(24,49,38,.12)]"
            >
              <Link href={`/services/${service.slug}`} className="block">
              <div role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-56 overflow-hidden bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>
                {!service.imageUrls[0] && <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />}
                <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold backdrop-blur">New listing</span>
                {!service.imageUrls[0] && <span className="absolute bottom-5 right-6 text-6xl opacity-80">{visual.art}</span>}
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold">{service.title}</h4>

                    <p className="mt-1 text-sm text-zinc-500">
                      {service.provider}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">${service.price}</p>
                    <p className="text-xs text-zinc-500">starting</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500"><span>📍</span><span>{service.city}, {service.state}</span></div>
              </div>
              </Link>
              <FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-xl shadow-sm backdrop-blur" />
            </article>
          )})}
        </div> : <div className="rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-14 text-center"><span className="text-4xl">🌱</span><h4 className="mt-4 text-xl font-bold">Local services are coming soon</h4><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c75]">Be the first local professional to create a real BookMe listing.</p><Link href="/providers/join" className="mt-6 inline-block rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">List your service</Link></div>}
      </section>
    </main>
  );
}
