import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

const providers = {
  "havoc-auto-care": {
    name: "Havoc Auto Care",
    category: "Car detailing",
    owner: "Marcus Chen",
    initials: "MC",
    rating: "4.9",
    reviews: 38,
    jobs: 126,
    years: 5,
    art: "🚙",
    gradient: "from-emerald-950 via-emerald-700 to-lime-300",
    bio: "We bring professional auto detailing to your driveway. Every vehicle gets careful, unhurried attention and products selected for the Pacific Northwest climate.",
    service: { slug: "premium-car-detail", title: "Premium interior & exterior detail", price: 120, duration: "2–3 hours" },
    specialties: ["Mobile service", "Interior restoration", "Paint protection"],
    review: { customer: "Jordan M.", text: "My car looked better than the day I bought it. Marcus was on time, thoughtful, and incredibly thorough." },
  },
  "evergreen-yard-co": {
    name: "Evergreen Yard Co.",
    category: "Lawn & garden",
    owner: "Evan Cole",
    initials: "EC",
    rating: "4.8",
    reviews: 24,
    jobs: 89,
    years: 4,
    art: "🌱",
    gradient: "from-lime-800 via-lime-600 to-yellow-200",
    bio: "Reliable, neighborly lawn care for Issaquah homes. We keep outdoor spaces healthy and tidy with straightforward pricing and dependable weekly service.",
    service: { slug: "weekly-lawn-care", title: "Weekly lawn care & cleanup", price: 45, duration: "1–2 hours" },
    specialties: ["Weekly maintenance", "Seasonal cleanup", "Edging & trimming"],
    review: { customer: "Priya S.", text: "Evan communicates clearly and our yard has never looked better. It is one less weekend chore to think about." },
  },
  "good-and-tidy": {
    name: "Good & Tidy",
    category: "Home cleaning",
    owner: "Sofia Ramirez",
    initials: "SR",
    rating: "4.9",
    reviews: 51,
    jobs: 174,
    years: 6,
    art: "🏡",
    gradient: "from-amber-900 via-amber-600 to-orange-100",
    bio: "Thoughtful home cleaning built around the way you live. Our small local team uses family-safe products and a detailed checklist so nothing gets overlooked.",
    service: { slug: "deep-home-cleaning", title: "Deep home cleaning", price: 85, duration: "2–4 hours" },
    specialties: ["Deep cleaning", "Family-safe products", "Move-in cleaning"],
    review: { customer: "Maya R.", text: "Good & Tidy made the whole house feel new again. The team was kind, efficient, and paid attention to every detail." },
  },
} as const;

type ProviderSlug = keyof typeof providers;

export function generateStaticParams() {
  return Object.keys(providers).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const provider = providers[slug as ProviderSlug];
  return provider ? { title: `${provider.name} | BookMe`, description: provider.bio } : {};
}

export default async function ProviderProfilePage({ params }: PageProps<"/providers/[slug]">) {
  const { slug } = await params;
  const provider = providers[slug as ProviderSlug];
  if (!provider) notFound();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link>
          <div className="flex items-center gap-2"><Link href="/account" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:block">My bookings</Link><Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5">Log in</Link><Link href="/signup" className="rounded-full bg-[#183126] px-5 py-2.5 text-sm font-semibold text-white">Sign up</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/services" className="text-sm font-semibold text-[#63766b] hover:text-[#183126]">← Back to services</Link>
        <section className="mt-7 overflow-hidden rounded-[2.5rem] border border-[#183126]/10 bg-white shadow-[0_12px_40px_rgba(24,49,38,.08)]">
          <div className={`relative h-44 bg-gradient-to-br ${provider.gradient} sm:h-56`}><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(255,255,255,.4),transparent_30%)]" /><span className="absolute bottom-5 right-8 text-7xl opacity-80 sm:text-8xl">{provider.art}</span></div>
          <div className="relative px-6 pb-8 sm:px-9">
            <div className="-mt-12 grid h-24 w-24 place-items-center rounded-[1.75rem] border-4 border-white bg-[#e7eee2] text-2xl font-bold shadow-lg">{provider.initials}</div>
            <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{provider.name}</h1><span className="rounded-full bg-[#e3f1e5] px-3 py-1 text-xs font-bold text-[#327149]">✓ Verified</span></div><p className="mt-2 text-[#6b7b73]">{provider.category} · Issaquah, WA · Owned by {provider.owner}</p></div>
              <Link href={`/services/${provider.service.slug}`} className="self-start rounded-full bg-[#eee25a] px-6 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 md:self-auto">View availability</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-[#183126]/10 pt-6"><div><p className="text-xl font-bold">★ {provider.rating}</p><p className="text-xs text-[#74837b]">{provider.reviews} reviews</p></div><div><p className="text-xl font-bold">{provider.jobs}</p><p className="text-xs text-[#74837b]">jobs completed</p></div><div><p className="text-xl font-bold">{provider.years} years</p><p className="text-xs text-[#74837b]">in business</p></div><div><p className="text-xl font-bold">100%</p><p className="text-xs text-[#74837b]">response rate</p></div></div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><h2 className="text-2xl font-bold tracking-tight">About {provider.name}</h2><p className="mt-4 text-base leading-7 text-[#62736a]">{provider.bio}</p><div className="mt-6 flex flex-wrap gap-2">{provider.specialties.map((item) => <span key={item} className="rounded-full bg-[#edf2e9] px-3 py-2 text-xs font-bold text-[#4f6d5a]">{item}</span>)}</div></section>
            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">What customers say</h2><span className="font-bold text-[#c48b28]">★ {provider.rating}</span></div><blockquote className="mt-6 border-l-4 border-[#eee25a] pl-5 text-lg leading-8 text-[#52675b]">“{provider.review.text}”</blockquote><p className="mt-4 text-sm font-bold">{provider.review.customer} <span className="font-normal text-[#7b8982]">· Verified booking</span></p></section>
          </div>
          <aside><section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_10px_30px_rgba(24,49,38,.07)]"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#708078]">Featured service</p><div className={`mt-4 grid h-36 place-items-center rounded-2xl bg-gradient-to-br ${provider.gradient} text-6xl`}>{provider.art}</div><h2 className="mt-5 text-xl font-bold">{provider.service.title}</h2><p className="mt-2 text-sm text-[#718078]">{provider.service.duration}</p><div className="mt-5 flex items-center justify-between border-t border-[#183126]/10 pt-5"><p className="font-bold">From ${provider.service.price}</p><Link href={`/services/${provider.service.slug}`} className="rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">View service</Link></div></section></aside>
        </div>
      </div>
    </main>
  );
}
