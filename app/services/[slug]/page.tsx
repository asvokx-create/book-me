import Link from "next/link";
import { notFound } from "next/navigation";
import BookingCard from "./booking-card";

const services = {
  "premium-car-detail": {
    title: "Premium interior & exterior detail",
    provider: "Havoc Auto Care",
    providerSlug: "havoc-auto-care",
    category: "Car detailing",
    price: 120,
    duration: "2–3 hours",
    rating: "4.9",
    reviews: 38,
    badge: "Top rated",
    art: "🚙",
    gradient: "from-emerald-950 via-emerald-700 to-lime-300",
    description: "Bring back that just-drove-it-off-the-lot feeling. A careful, complete detail for your vehicle, done at your home or office.",
    includes: ["Exterior hand wash and dry", "Wheel and tire deep clean", "Interior vacuum and wipe-down", "Windows, mirrors, and finishing spray"],
  },
  "weekly-lawn-care": {
    title: "Weekly lawn care & cleanup",
    provider: "Evergreen Yard Co.",
    providerSlug: "evergreen-yard-co",
    category: "Lawn & garden",
    price: 45,
    duration: "1–2 hours",
    rating: "4.8",
    reviews: 24,
    badge: "Popular",
    art: "🌱",
    gradient: "from-lime-800 via-lime-600 to-yellow-200",
    description: "A dependable weekly refresh that keeps your yard tidy, healthy, and ready to enjoy—without giving up your weekend.",
    includes: ["Lawn mowing and edging", "Walkway and patio blow-off", "Light weed removal", "Clipping and yard-waste cleanup"],
  },
  "deep-home-cleaning": {
    title: "Deep home cleaning",
    provider: "Good & Tidy",
    providerSlug: "good-and-tidy",
    category: "Home cleaning",
    price: 85,
    duration: "2–4 hours",
    rating: "4.9",
    reviews: 51,
    badge: "Available today",
    art: "🏡",
    gradient: "from-amber-900 via-amber-600 to-orange-100",
    description: "A thoughtful top-to-bottom clean for the rooms you use most. Come home to fresh surfaces, tidy spaces, and one less thing on your list.",
    includes: ["Kitchen and bathroom deep clean", "Dusting and surface care", "Floors vacuumed and mopped", "Trash removal and final tidy"],
  },
} as const;

type ServiceSlug = keyof typeof services;

export function generateStaticParams() {
  return Object.keys(services).map((slug) => ({ slug }));
}

export default async function ServicePage({ params }: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const service = services[slug as ServiceSlug];

  if (!service) notFound();

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            BookMe
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/providers/join" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:block">List your service</Link>
            <Link href="/account" className="hidden rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5 lg:block">My bookings</Link>
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#183126]/5">Log in</Link>
            <Link href="/signup" className="rounded-full bg-[#183126] px-5 py-2.5 text-sm font-semibold text-white">Sign up</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f7268] transition hover:text-[#183126]">← Back to services</Link>

        <div className="mt-7 grid gap-10 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className={`relative h-72 overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${service.gradient} sm:h-[420px]`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.4),transparent_28%)]" />
              <div className="absolute bottom-[-40%] left-[18%] h-[90%] w-[80%] rounded-[50%] border-[36px] border-white/20" />
              <span className="absolute left-6 top-6 rounded-full bg-white/90 px-4 py-2 text-xs font-bold backdrop-blur">{service.badge}</span>
              <span className="absolute bottom-8 right-10 text-8xl opacity-80 sm:text-9xl">{service.art}</span>
            </div>

            <div className="py-8">
              <p className="text-sm font-bold uppercase tracking-[.15em] text-[#6c7d74]">{service.category}</p>
              <h1 className="mt-3 text-4xl font-bold tracking-[-.045em] sm:text-5xl">{service.title}</h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="font-bold text-[#c58b24]">★ {service.rating} <span className="font-normal text-[#718078]">({service.reviews} reviews)</span></span>
                <span className="text-[#718078]">Served by <Link href={`/providers/${service.providerSlug}`} className="font-bold text-[#183126] underline decoration-[#c7bb41] decoration-2 underline-offset-4">{service.provider}</Link></span>
              </div>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5b6d64]">{service.description}</p>

              <div className="mt-10 border-t border-[#183126]/10 pt-9">
                <h2 className="text-2xl font-bold tracking-tight">What&apos;s included</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {service.includes.map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white p-4 text-sm font-medium shadow-[0_4px_18px_rgba(24,49,38,.04)]">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e6f1e7] font-bold text-[#33704a]">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="lg:pt-16">
            <BookingCard
              price={service.price}
              duration={service.duration}
              serviceTitle={service.title}
              provider={service.provider}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
