import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration, getProviderById, getServiceVisual } from "@/lib/marketplace";
import AccountNav from "@/components/account-nav";
import ContactProviderLink from "@/components/contact-provider-link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProviderById(slug);
  return provider ? { title: `${provider.businessName} | BookMe`, description: provider.bio } : {};
}

export default async function ProviderProfilePage({ params }: PageProps<"/providers/[slug]">) {
  const { slug } = await params;
  const provider = await getProviderById(slug);
  if (!provider) notFound();

  const featured = provider.services[0] ?? null;
  const visual = getServiceVisual(featured?.category ?? "service");
  const initials = provider.businessName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  const categories = [...new Set(provider.services.map((service) => service.category))];

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link><AccountNav /></div></header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/services" className="text-sm font-semibold text-[#63766b] hover:text-[#183126]">← Back to services</Link>
        <section className="mt-7 overflow-hidden rounded-[2.5rem] border border-[#183126]/10 bg-white shadow-[0_12px_40px_rgba(24,49,38,.08)]">
          <div role="img" aria-label={`${provider.businessName} featured service`} style={featured?.imageUrls[0] ? { backgroundImage: `url("${featured.imageUrls[0]}")` } : undefined} className={`relative h-44 bg-cover bg-center sm:h-56 ${featured?.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{!featured?.imageUrls[0] && <><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,.4),transparent_30%)]" /><span className="absolute bottom-5 right-8 text-7xl opacity-80 sm:text-8xl">{visual.art}</span></>}</div>
          <div className="relative px-6 pb-8 sm:px-9"><div className="-mt-12 grid h-24 w-24 place-items-center rounded-[1.75rem] border-4 border-white bg-[#e7eee2] text-2xl font-bold shadow-lg">{initials}</div><div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{provider.businessName}</h1><span className="rounded-full bg-[#edf2e9] px-3 py-1 text-xs font-bold text-[#4f6d5a]">{provider.isVerified ? "✓ Verified" : "New provider"}</span></div><p className="mt-2 text-[#6b7b73]">Serving {provider.city}, {provider.state}</p></div><div className="flex flex-wrap gap-2"><ContactProviderLink providerId={provider.id} serviceId={featured?.id} className="rounded-full border border-[#183126]/15 bg-white px-6 py-3.5 text-sm font-bold transition hover:bg-[#e5eddf]" />{featured && <Link href={`/services/${featured.slug}`} className="rounded-full bg-[#eee25a] px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5">View service</Link>}</div></div></div>
        </section>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-2xl font-bold tracking-tight">About {provider.businessName}</h2><p className="mt-4 text-base leading-7 text-[#62736a]">{provider.bio}</p>{categories.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{categories.map((category) => <span key={category} className="rounded-full bg-[#edf2e9] px-3 py-2 text-xs font-bold text-[#4f6d5a]">{category}</span>)}</div>}<div className="mt-8 rounded-2xl bg-[#f5f5ef] p-5"><p className="font-bold">No reviews yet</p><p className="mt-1 text-sm text-[#718078]">Verified customer reviews will appear after completed BookMe bookings.</p></div></section>
          <aside>{featured ? <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_10px_30px_rgba(24,49,38,.07)]"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#708078]">Featured service</p><div role="img" aria-label={`${featured.title} cover`} style={featured.imageUrls[0] ? { backgroundImage: `url("${featured.imageUrls[0]}")` } : undefined} className={`mt-4 grid h-36 place-items-center rounded-2xl bg-cover bg-center text-6xl ${featured.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{featured.imageUrls[0] ? "" : visual.art}</div><h2 className="mt-5 text-xl font-bold">{featured.title}</h2><p className="mt-2 text-sm text-[#718078]">{formatDuration(featured.durationMinutes)}</p><div className="mt-5 flex items-center justify-between border-t border-[#183126]/10 pt-5"><p className="font-bold">From ${featured.price}</p><Link href={`/services/${featured.slug}`} className="rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">View service</Link></div></section> : <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="font-bold">No active services</p></section>}</aside>
        </div>
      </div>
    </main>
  );
}
