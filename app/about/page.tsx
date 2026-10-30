import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteHeader from "@/components/public-site-header";
import UiIcon, { type UiIconName } from "@/components/ui-icon";
import { publicPageMetadata } from "@/lib/seo";

const title = "About BubsBookings | Founder Christian Talluto";
const description = "Learn about BubsBookings, an online service marketplace founded by Christian Talluto to make finding, booking, and managing services easier.";

export const metadata: Metadata = {
  ...publicPageMetadata({ title, description, pathname: "/about" }),
  title: { absolute: title },
};

const features: ReadonlyArray<{ icon: UiIconName; title: string; description: string }> = [
  { icon: "services", title: "Free Provider Listings", description: "Providers can create listings free forever with no upfront listing cost. The free plan has a 10% fee on completed bookings." },
  { icon: "calendar", title: "Booking Management", description: "Keep bookings, availability, and customer information organized in one place." },
  { icon: "messages", title: "Direct Communication", description: "Customers and providers can communicate through BubsBookings before and after a booking." },
  { icon: "revenue", title: "Payment Management", description: "Providers can manage payment activity and track earnings through the platform." },
  { icon: "overview", title: "Multiple Service Categories", description: "Explore cleaning, landscaping, photography, car detailing, and other local or remote services." },
];

const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: title,
  url: "https://bubsbookings.com/about",
  description,
  about: { "@id": "https://bubsbookings.com/#organization" },
};

export default function AboutPage() {
  return <main className="min-h-screen overflow-x-clip bg-[#f8f7f3] text-[#183126]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd).replace(/</g, "\\u003c") }} />
    <PublicSiteHeader />

    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_85%_16%,rgba(214,233,208,.95),transparent_30%),linear-gradient(135deg,#f8f7f3,#edf3e8)]">
      <div className="absolute -left-28 bottom-[-9rem] h-72 w-72 rounded-full border-[2.5rem] border-white/60" />
      <div className="site-container relative grid gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#60766a]">About BubsBookings</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-.055em] sm:text-6xl">Making Local Services Easier to Find and Book</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#587066]">BubsBookings is an online marketplace that connects customers with service providers. From car detailing and landscaping to house cleaning, photography, and more, BubsBookings makes it easier to discover services, communicate with providers, and manage bookings in one place.</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#587066]">Our goal is to simplify booking services while giving independent businesses the tools they need to grow.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/#nearby-listings" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-6 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#e1d43d]">Find a Service <UiIcon name="arrow-right" className="ml-2 h-4 w-4" /></Link><Link href="/providers/join" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-6 py-3 text-sm font-bold transition hover:bg-[#edf2e9]">Become a Provider</Link></div>
        </div>
        <aside className="rounded-[2rem] border border-[#183126]/10 bg-[#183126] p-7 text-white shadow-[0_24px_70px_rgba(24,49,38,.16)] sm:p-9" aria-label="BubsBookings at a glance">
          <p className="text-xs font-bold uppercase tracking-[.17em] text-[#b8cec0]">Built for everyday service needs</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-2xl bg-white/10 p-5"><UiIcon name="search" className="h-6 w-6 text-[#eee25a]" /><p className="mt-4 font-bold">Discover services</p><p className="mt-2 text-sm leading-6 text-[#cad8d1]">Compare services and clear listing details before you book.</p></div><div className="rounded-2xl bg-white/10 p-5"><UiIcon name="messages" className="h-6 w-6 text-[#eee25a]" /><p className="mt-4 font-bold">Keep it connected</p><p className="mt-2 text-sm leading-6 text-[#cad8d1]">Messages, booking details, and updates stay together.</p></div></div>
        </aside>
      </div>
    </section>

    <section className="site-container grid gap-8 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
      <div className="rounded-[2rem] bg-[#e6eee2] p-7 sm:p-9"><UiIcon name="opportunities" className="h-9 w-9 text-[#52755d]" /><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#60766a]">Our Mission</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Simple service booking, stronger independent businesses.</h2></div>
      <div><h2 className="text-3xl font-bold tracking-[-.04em]">Our Mission</h2><p className="mt-5 text-base leading-8 text-[#5d7066]">At BubsBookings, we believe finding and booking services should be simple.</p><p className="mt-4 text-base leading-8 text-[#5d7066]">Our mission is to connect customers with reliable service providers while giving businesses the tools to manage their listings, bookings, payments, and customer relationships.</p><p className="mt-4 text-base leading-8 text-[#5d7066]">We want to make it easier for independent businesses to establish an online presence without expensive upfront costs.</p></div>
    </section>

    <section className="border-y border-[#183126]/10 bg-white"><div className="site-container grid gap-8 px-5 py-14 sm:px-6 sm:py-20 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
      <div className="rounded-[2rem] bg-[#183126] p-8 text-white shadow-[0_18px_50px_rgba(24,49,38,.14)] sm:p-10"><p className="grid h-16 w-16 place-items-center rounded-2xl bg-[#eee25a] text-2xl font-black text-[#183126]">CT</p><p className="mt-8 text-xs font-bold uppercase tracking-[.17em] text-[#b8cec0]">Founder</p><h2 className="mt-3 text-4xl font-bold tracking-[-.05em]">Christian Talluto</h2><p className="mt-2 text-lg font-semibold text-[#d6e2db]">Founder of BubsBookings</p></div>
      <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Meet the Founder</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">A marketplace built to make service booking simpler.</h2><p className="mt-5 text-base leading-8 text-[#5d7066]">BubsBookings was founded by Christian Talluto, an entrepreneur who wanted to simplify how people find and book services.</p><p className="mt-4 text-base leading-8 text-[#5d7066]">Christian created BubsBookings with the goal of building a platform that helps independent service providers manage their businesses while making it easier for customers to discover and book the services they need.</p><p className="mt-4 text-base leading-8 text-[#5d7066]">His vision is to grow BubsBookings into a trusted marketplace that supports small businesses and makes everyday services more accessible.</p></div>
    </div></section>

    <section className="site-container px-5 py-14 sm:px-6 sm:py-20"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Why BubsBookings?</p><h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Tools that help every side of a booking move forward.</h2></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{features.map(({ icon, title: featureTitle, description: featureDescription }) => <article key={featureTitle} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6 shadow-[0_8px_26px_rgba(24,49,38,.05)]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7efe3] text-[#41694d]"><UiIcon name={icon} className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-bold">{featureTitle}</h3><p className="mt-3 text-sm leading-7 text-[#61736a]">{featureDescription}</p></article>)}</div></section>

    <section className="site-container px-5 pb-16 sm:px-6 sm:pb-24"><div className="rounded-[2rem] bg-[#183126] px-7 py-10 text-center text-white sm:px-10 sm:py-14"><p className="text-xs font-bold uppercase tracking-[.17em] text-[#b8cec0]">Ready to Get Started?</p><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-bold tracking-[-.04em] sm:text-4xl">Whether you&apos;re looking for a service or offering one, BubsBookings makes it easier to connect.</h2><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/#nearby-listings" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-6 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#e1d43d]">Find a Service</Link><Link href="/providers/join" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold transition hover:bg-white/15">Become a Provider</Link></div></div></section>
  </main>;
}
