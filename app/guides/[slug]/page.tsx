import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, GUIDES } from "@/lib/guides";

export function generateStaticParams() { return GUIDES.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.description, alternates: { canonical: `/guides/${guide.slug}` }, openGraph: { type: "article", title: guide.title, description: guide.description, publishedTime: guide.publishedAt, modifiedTime: guide.updatedAt } };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, datePublished: guide.publishedAt, dateModified: guide.updatedAt, author: { "@type": "Organization", name: "BubsBookings Editorial Team" }, publisher: { "@type": "Organization", name: "BubsBookings", url: "https://bubsbookings.com" }, mainEntityOfPage: `https://bubsbookings.com/guides/${guide.slug}` };
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><Link href="/" className="font-bold">BubsBookings</Link><Link href="/guides" className="text-sm font-bold">All articles</Link></div></header><article className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#687b70]">{guide.category} · {guide.readMinutes} min read</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-[-.05em] sm:text-6xl">{guide.title}</h1><p className="mt-5 text-xl leading-8 text-[#5d7066]">{guide.description}</p><p className="mt-5 text-xs font-semibold text-[#7a8981]">Published {new Date(`${guide.publishedAt}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} · BubsBookings Editorial Team</p><div className="mt-10 space-y-10">{guide.sections.map((section) => <section key={section.heading}><h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-8 text-[#53685d]">{paragraph}</p>)}{section.checklist && <ul className="mt-5 grid gap-3 rounded-2xl bg-white p-5 sm:p-6">{section.checklist.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="font-bold text-[#6d8428]">✓</span><span>{item}</span></li>)}</ul>}</section>)}</div><div className="mt-12 rounded-[2rem] bg-[#183126] p-7 text-white"><h2 className="text-2xl font-bold">Ready to compare local providers?</h2><p className="mt-2 text-sm text-white/75">Browse services, review listing details, and keep each booking conversation in one place.</p><Link href={guide.ctaHref ?? "/services"} className="mt-5 inline-flex rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126]">{guide.ctaLabel ?? "Explore services"}</Link></div></article></main>;
}
