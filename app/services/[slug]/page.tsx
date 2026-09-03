import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, getServiceBySlug, getServiceVisual } from "@/lib/marketplace";
import BookingCard from "./booking-card";
import AccountNav from "@/components/account-nav";
import FavoriteButton from "@/components/favorite-button";
import ContactProviderLink from "@/components/contact-provider-link";

export const dynamic = "force-dynamic";

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const visual = getServiceVisual(service.category);
  const duration = formatDuration(service.durationMinutes);

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>BookMe</Link>
          <div className="flex items-center gap-3"><Link href="/providers/join" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:block">List your service</Link><AccountNav /></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f7268] transition hover:text-[#183126]">← Back to services</Link>
        <div className="mt-7 grid gap-10 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-72 overflow-hidden rounded-[2.5rem] bg-cover bg-center sm:h-[420px] ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{!service.imageUrls[0] && <><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" /><div className="absolute bottom-[-40%] left-[18%] h-[90%] w-[80%] rounded-[50%] border-[36px] border-white/20" /><span className="absolute bottom-8 right-10 text-8xl opacity-80 sm:text-9xl">{visual.art}</span></>}<span className="absolute left-6 top-6 rounded-full bg-white/90 px-4 py-2 text-xs font-bold shadow-sm backdrop-blur">New listing</span><FavoriteButton serviceId={service.id} serviceTitle={service.title} className="absolute right-6 top-6 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/90 text-2xl shadow-sm backdrop-blur" /></div>
            {service.imageUrls.length > 1 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{service.imageUrls.slice(1).map((url, index) => <div key={url} role="img" aria-label={`${service.title} photo ${index + 2}`} style={{ backgroundImage: `url("${url}")` }} className="aspect-[4/3] rounded-2xl bg-[#e5e8e2] bg-cover bg-center" />)}</div>}
            <div className="py-8">
              <p className="text-sm font-bold uppercase tracking-[.15em] text-[#6c7d74]">{service.category}</p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{service.title}</h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm"><span className="text-[#718078]">📍 {service.city}, {service.state}</span><span className="text-[#718078]">Served by <Link href={`/providers/${service.providerId}`} className="font-bold text-[#183126] underline decoration-[#c7bb41] decoration-2 underline-offset-4">{service.provider}</Link></span><ContactProviderLink providerId={service.providerId} serviceId={service.id} className="rounded-full border border-[#183126]/15 bg-white px-4 py-2 font-bold text-[#183126] transition hover:border-[#597563] hover:bg-[#e5eddf]" /></div>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5b6d64]">{service.description}</p>
              <div className="mt-10 border-t border-[#183126]/10 pt-9"><h2 className="text-2xl font-bold tracking-tight">Service details</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 shadow-[0_4px_18px_rgba(24,49,38,.04)]"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Typical duration</p><p className="mt-2 font-bold">{duration}</p></div><div className="rounded-2xl bg-white p-5 shadow-[0_4px_18px_rgba(24,49,38,.04)]"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">Starting price</p><p className="mt-2 font-bold">${service.price}</p></div></div></div>
            </div>
          </div>
          <aside className="lg:pt-16"><BookingCard serviceId={service.id} price={service.price} duration={duration} serviceTitle={service.title} provider={service.provider} /></aside>
        </div>
      </div>
    </main>
  );
}
