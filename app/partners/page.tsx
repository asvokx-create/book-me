import type { Metadata } from "next";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import MobileSiteNav from "@/components/mobile-site-nav";
import PartnerApplicationForm from "@/components/partner-application-form";

const title = "Creator Partner Program";
const description = "Apply to the BubsBookings Creator Partner Program and earn from qualified local-service provider referrals under clear program terms.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/partners" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: "/partners",
    title: `${title} | BubsBookings`,
    description,
    images: [{ url: "/partners/opengraph-image", width: 1200, height: 630, alt: "BubsBookings Creator Partner Program" }],
  },
  twitter: { card: "summary_large_image", title: `${title} | BubsBookings`, description, images: ["/partners/opengraph-image"] },
};

const steps = [
  ["Share BubsBookings", "Use your unique referral link or creator code in disclosed, accurate content."],
  ["A provider gets established", "The new provider completes onboarding, publishes a legitimate listing, and completes an eligible paid booking."],
  ["Commissions clear", "Eligible commission remains on hold through the program's refund and dispute period, then becomes payable."],
] as const;

const audienceTopics = ["Freelancing", "Local and small business", "Side hustles", "Service businesses", "Entrepreneurship", "Gig work and getting clients"];

const faqs = [
  ["When do I get paid?", "A commission is created only after the referred provider completes an eligible paid booking and receives their provider payout. It then remains on hold for the program's configured holding period. Once the hold has passed, your payable balance reaches the program minimum, your tax review is complete, and your connected Stripe payout account is ready, BubsBookings can transfer an administrator-reviewed payout to your Stripe balance."],
  ["What counts as a qualified provider?", "A qualified provider must be genuinely new, complete provider onboarding, publish a legitimate active listing, and complete an eligible paid booking. The provider payout must succeed, and the booking cannot have a disqualifying refund, dispute, chargeback, or fraud concern."],
  ["How long do I earn from a referred provider?", "The Standard Creator Program currently pays eligible revenue share for six months. That period begins when the provider qualifies through their first eligible completed and paid booking, unless your approved program terms state something different."],
  ["How does referral tracking work?", "A valid link from an active partner records the referral and saves a first-party referral cookie for the program's attribution window, currently 60 days for the standard program. A later valid partner link replaces the earlier one. A valid code entered during provider onboarding intentionally overrides the saved link. The referral token is consumed and attribution locks when the new provider profile is created."],
  ["Do I need to be a BubsBookings provider?", "No. Creators, community leaders, agencies, and affiliates may apply without offering services on BubsBookings. Self-referrals and duplicate or controlled provider accounts are not eligible."],
  ["What happens if a booking is refunded or disputed?", "The related commission may be held, reduced, rejected, or reversed. BubsBookings keeps the financial history rather than silently deleting the original ledger entry."],
  ["Can larger creators discuss a custom partnership?", "Yes. Established creators may contact BubsBookings to discuss a different structure. Contact does not promise an upfront sponsorship, guaranteed payment, or specific rate."],
  ["How should I disclose the affiliate relationship?", "Clearly tell people that you may earn compensation when they use your link or code. Put the disclosure close to the promotion, use plain language, and do not hide it behind vague wording or a distant profile page."],
] as const;

export default function PartnersPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
  };

  return <main className="min-h-screen overflow-x-clip bg-[#f8f7f3] text-[#183126]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
    <header className="border-b border-[#183126]/10 bg-white/90"><div className="site-container flex items-center justify-between px-5 py-4"><Link href="/"><BrandLockup /></Link><div className="flex items-center gap-3"><Link href="/affiliate" className="hidden rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold sm:inline-flex">Partner sign in</Link><MobileSiteNav /></div></div></header>

    <section className="overflow-hidden bg-[radial-gradient(circle_at_80%_10%,#d9e9d5,transparent_38%),linear-gradient(135deg,#f8f7f3,#f0f4ea)]"><div className="site-container grid gap-10 px-5 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#64786d]">BubsBookings partner program</p><h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-6xl">Help local providers grow. Earn when they succeed.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">For creators, community leaders, agencies, and affiliates who can introduce legitimate service providers to BubsBookings.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"><a href="#apply" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-7 py-3.5 font-bold shadow-[0_10px_30px_rgba(202,185,42,.22)]">Apply to become a partner</a><Link href="/affiliate" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-6 py-3.5 font-bold">Already a partner? Sign in</Link></div></div>
      <aside className="rounded-[2rem] bg-[#123d2e] p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9c3b4]">Standard creator program</p><p className="mt-4 text-4xl font-bold">$10</p><p className="mt-1 text-sm text-[#c7d7cf]">activation bonus for a qualified referred provider</p><p className="mt-6 text-4xl font-bold">20%</p><p className="mt-1 text-sm leading-6 text-[#c7d7cf]">of eligible BubsBookings provider marketplace fee revenue for 6 months—not 20% of the provider&apos;s service price.</p><div className="mt-5 rounded-2xl bg-[#eee25a] p-5 text-[#183126]"><p className="text-xs font-bold uppercase tracking-[.14em]">Simple example</p><p className="mt-2 text-sm leading-6">A provider completes a <strong>$250 booking</strong>. If BubsBookings earns a <strong>$25 provider booking fee</strong>, your 20% share is <strong>$5</strong>. If this is the provider&apos;s first qualifying booking, you also earn the <strong>$10 activation bonus</strong>.</p></div><p className="mt-4 rounded-2xl bg-white/8 p-4 text-xs leading-5 text-[#d8e3dd]">Earnings become payable only after the provider is paid and the holding period passes. Refunds, disputes, or chargebacks may reduce or reverse them. Program terms are saved when a provider is attributed.</p></aside>
    </div></section>

    <section className="site-container px-5 py-14"><div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Who this is for</p><h2 className="mt-2 text-3xl font-bold tracking-tight">A strong fit for practical business creators</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[#61736a]">The program works best when your audience includes people who provide—or want to start providing—real local services.</p><div className="mt-5 flex flex-wrap gap-2">{audienceTopics.map(topic => <span key={topic} className="rounded-full border border-[#183126]/10 bg-white px-4 py-2 text-sm font-bold">{topic}</span>)}</div></div><aside className="rounded-[2rem] bg-[#e6eee1] p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#63756b]">Established audience?</p><h2 className="mt-2 text-2xl font-bold">Discuss a custom partnership</h2><p className="mt-3 text-sm leading-7 text-[#5d7066]">If your audience or campaign needs a different structure, tell us what you have in mind. Reaching out does not guarantee an upfront sponsorship, payment, or custom rate.</p><a href="mailto:christian@bubsbookings.com?subject=BubsBookings%20custom%20creator%20partnership" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Contact BubsBookings</a></aside></div></section>

    <section className="site-container px-5 py-14"><h2 className="text-3xl font-bold tracking-tight">How referrals become payable</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{steps.map(([stepTitle, body], index) => <article key={stepTitle} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eee25a] text-sm font-bold">{index + 1}</span><h3 className="mt-4 text-xl font-bold">{stepTitle}</h3><p className="mt-2 text-sm leading-6 text-[#687970]">{body}</p></article>)}</div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2"><section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7"><h2 className="text-2xl font-bold">What counts as qualified</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-[#5d7066]"><li>✓ A genuinely new provider account</li><li>✓ Completed provider onboarding and an active legitimate listing</li><li>✓ A real paid booking that is completed</li><li>✓ The provider&apos;s eligible payout was successfully released</li><li>✓ No disqualifying refund, dispute, chargeback, or fraud concern</li><li>✓ The applicable commission holding period has passed</li></ul></section><section className="rounded-[2rem] border border-[#183126]/10 bg-[#f3f0b2]/35 p-7"><h2 className="text-2xl font-bold">Clear promotion rules</h2><p className="mt-4 text-sm leading-7 text-[#5d7066]">Always disclose that you may earn compensation. Do not promise provider earnings, misrepresent BubsBookings, bid on protected brand terms, impersonate another creator, create self-referrals, or encourage fake bookings. BubsBookings may review, hold, reverse, or reject commissions tied to ineligible activity.</p></section></div>
    </section>

    <section className="site-container px-5 pb-14"><div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Creator partner FAQ</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Questions before you apply</h2><div className="mt-6 divide-y divide-[#183126]/10">{faqs.map(([question, answer]) => <details key={question} className="group py-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-bold marker:content-none">{question}<span aria-hidden="true" className="text-xl transition group-open:rotate-45">+</span></summary><p className="max-w-4xl pb-2 pr-8 text-sm leading-7 text-[#61736a]">{answer}</p></details>)}</div></div></section>

    <section id="apply" className="site-container scroll-mt-6 px-5 pb-16"><PartnerApplicationForm /></section>
  </main>;
}
