import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AccountNav from "@/components/account-nav";
import { getCompanyBySlug } from "@/lib/companies";
import { getServiceVisual } from "@/lib/marketplace";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const company = await getCompanyBySlug((await params).slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.name} services`,
    description: `View every service offered by ${company.name} in ${company.city}, ${company.state}.`,
    alternates: { canonical: `/companies/${company.slug}` },
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const company = await getCompanyBySlug((await params).slug);
  if (!company) notFound();
  return <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
    <header className="sticky top-0 z-50 border-b border-[#183126]/10 bg-white/95 backdrop-blur-xl"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><AccountNav /></div></header>
    <section className="bg-[#183126] text-white"><div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16"><Link href="/services" className="text-sm font-bold text-[#c1d0c8]">← Browse services</Link><div className="mt-7 flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#eee25a]">Company page</p><h1 className="mt-3 text-4xl font-bold tracking-[-.05em] sm:text-5xl">{company.name}</h1><p className="mt-4 text-[#c1d0c8]">Owned by {company.ownerName} · Serving {company.city}, {company.state}</p></div>{company.verified && <span className="w-fit rounded-full bg-[#e4f1e5] px-4 py-2 text-xs font-bold text-[#34704a]">✓ BubsBookings screened</span>}</div>{company.bio && <p className="mt-7 max-w-3xl text-base leading-7 text-[#d2ddd7]">{company.bio}</p>}</div></section>
    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Services by {company.name}</p><h2 className="mt-2 text-3xl font-bold">Choose a service</h2></div><span className="text-sm font-bold text-[#718078]">{company.services.length} {company.services.length === 1 ? "listing" : "listings"}</span></div>
      {company.services.length ? <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{company.services.map((service) => { const visual = getServiceVisual(service.category); return <article key={service.id} className="overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-sm"><div style={service.imageUrl ? { backgroundImage: `url("${service.imageUrl}")` } : undefined} className={`grid h-48 place-items-center bg-cover bg-center ${service.imageUrl ? "" : `bg-gradient-to-br ${visual.gradient}`}`}><span className="text-5xl">{service.imageUrl ? "" : visual.art}</span></div><div className="p-6"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">{service.category}</p><div className="mt-2 flex items-start justify-between gap-4"><h3 className="text-xl font-bold">{service.title}</h3><p className="shrink-0 font-bold">${service.price}<span className="block text-right text-[10px] font-normal text-[#718078]">starting</span></p></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#65766d]">{service.description}</p><Link href={`/services/${service.slug}`} className="mt-5 inline-flex rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold">View and book</Link></div></article>; })}</div> : <div className="mt-7 rounded-[2rem] bg-white p-10 text-center"><p className="font-bold">No active services right now</p><p className="mt-2 text-sm text-[#718078]">Check back after {company.name} publishes its next listing.</p></div>}
    </section>
  </main>;
}
