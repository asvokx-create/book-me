import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, GUIDES } from "@/lib/guides";

export function generateStaticParams() { return GUIDES.map((guide) => ({ slug: guide.slug })); }

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const imageUrl = `/guides/${guide.slug}/opengraph-image`;
  return {
    title: guide.title,
    description: guide.description,
    authors: [{ name: "BubsBookings Editorial Team", url: "/guides" }],
    category: guide.category,
    alternates: { canonical: `/guides/${guide.slug}` },
    robots: { index: true, follow: true },
    openGraph: { type: "article", url: `/guides/${guide.slug}`, siteName: "BubsBookings", title: guide.title, description: guide.description, publishedTime: guide.publishedAt, modifiedTime: guide.updatedAt, authors: ["BubsBookings Editorial Team"], section: guide.category, images: [{ url: imageUrl, width: 1200, height: 630, alt: guide.title }] },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description, images: [imageUrl] },
  };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const articleUrl = `https://bubsbookings.com/guides/${guide.slug}`;
  const imageUrl = `${articleUrl}/opengraph-image`;
  const wordCount = guide.sections.reduce((total, section) => total + section.paragraphs.join(" ").split(/\s+/).length + (section.checklist?.join(" ").split(/\s+/).length ?? 0), 0);
  const sameCategory = GUIDES.filter((item) => item.slug !== guide.slug && item.category === guide.category);
  const otherGuides = GUIDES.filter((item) => item.slug !== guide.slug && item.category !== guide.category);
  const relatedGuides = [...sameCategory, ...otherGuides].slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BlogPosting", "@id": `${articleUrl}#article`, headline: guide.title, description: guide.description, image: [imageUrl], datePublished: guide.publishedAt, dateModified: guide.updatedAt, articleSection: guide.category, wordCount, author: { "@type": "Organization", name: "BubsBookings Editorial Team", url: "https://bubsbookings.com/guides" }, publisher: { "@type": "Organization", name: "BubsBookings", url: "https://bubsbookings.com" }, mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl }, isPartOf: { "@type": "Blog", name: "BubsBookings Blog", url: "https://bubsbookings.com/guides" } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://bubsbookings.com" }, { "@type": "ListItem", position: 2, name: "Guides", item: "https://bubsbookings.com/guides" }, { "@type": "ListItem", position: 3, name: guide.title, item: articleUrl }] },
    ],
  };
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><Link href="/" className="font-bold">BubsBookings</Link><Link href="/guides" className="text-sm font-bold">All articles</Link></div></header><article className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#718078]"><Link href="/" className="hover:text-[#183126]">Home</Link><span aria-hidden="true">/</span><Link href="/guides" className="hover:text-[#183126]">Guides</Link><span aria-hidden="true">/</span><span className="text-[#183126]">{guide.category}</span></nav><p className="mt-6 text-xs font-bold uppercase tracking-[.15em] text-[#687b70]">{guide.category} · {guide.readMinutes} min read</p><h1 className="mt-4 text-4xl font-bold leading-tight tracking-[-.05em] sm:text-6xl">{guide.title}</h1><p className="mt-5 text-xl leading-8 text-[#5d7066]">{guide.description}</p><p className="mt-5 text-xs font-semibold text-[#7a8981]">Published <time dateTime={guide.publishedAt}>{new Date(`${guide.publishedAt}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time> · BubsBookings Editorial Team</p><div className="mt-10 space-y-10">{guide.sections.map((section) => <section key={section.heading}><h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-8 text-[#53685d]">{paragraph}</p>)}{section.checklist && <ul className="mt-5 grid gap-3 rounded-2xl bg-white p-5 sm:p-6">{section.checklist.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="font-bold text-[#6d8428]">✓</span><span>{item}</span></li>)}</ul>}</section>)}</div><div className="mt-12 rounded-[2rem] bg-[#183126] p-7 text-white"><h2 className="text-2xl font-bold">{guide.ctaHeading ?? "Ready to compare local providers?"}</h2><p className="mt-2 text-sm text-white/75">{guide.ctaDescription ?? "Browse services, review listing details, and keep each booking conversation in one place."}</p><Link href={guide.ctaHref ?? "/services"} className="mt-5 inline-flex rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126]">{guide.ctaLabel ?? "Explore services"}</Link></div><section className="mt-12 border-t border-[#183126]/10 pt-9"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Keep reading</p><h2 className="mt-2 text-2xl font-bold">Related BubsBookings guides</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{relatedGuides.map((related) => <Link key={related.slug} href={`/guides/${related.slug}`} className="rounded-2xl border border-[#183126]/10 bg-white p-4 transition hover:border-[#6c816f] hover:bg-[#edf2e9]"><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#718078]">{related.category}</span><span className="mt-2 block text-sm font-bold leading-5">{related.title}</span></Link>)}</div><Link href="/guides" className="mt-5 inline-flex text-sm font-bold underline decoration-[#c7bb41] decoration-2 underline-offset-4">Browse all guides →</Link></section></article></main>;
}
