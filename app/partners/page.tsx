import type { Metadata } from "next";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import MobileSiteNav from "@/components/mobile-site-nav";
import PartnerApplicationForm from "@/components/partner-application-form";
import PartnerTermsLink from "@/components/partner-terms-link";
import { STANDARD_PROVIDER_GROWTH_MILESTONES } from "@/lib/affiliate-milestone-config";

const title = "Partner Program";
const description = "Apply to the BubsBookings Partner Program and earn from qualified service-provider referrals under clear program terms.";

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
    images: [{ url: "/partners/opengraph-image", width: 1200, height: 630, alt: "BubsBookings Partner Program" }],
  },
  twitter: { card: "summary_large_image", title: `${title} | BubsBookings`, description, images: ["/partners/opengraph-image"] },
};

const steps = [
  ["Share BubsBookings", "Use your unique referral link or Partner code in disclosed, accurate content."],
  ["A provider gets established", "The new provider completes onboarding, publishes a legitimate listing, and completes an eligible paid booking."],
  ["Commissions clear", "Eligible commission remains on hold through the program's refund and dispute period, then becomes payable."],
] as const;

const audienceTopics = ["Freelancing", "Local and small business", "Side hustles", "Service businesses", "Entrepreneurship", "Gig work and getting clients"];

const faqs = [
  ["When do I get paid?", "A commission is created only after the referred provider completes an eligible paid booking and receives their provider payout. It then remains on hold for the program's configured holding period. Once the hold has passed, your payable balance reaches the program minimum, your tax review is complete, and your connected Stripe payout account is ready, BubsBookings automatically schedules the eligible payout to your Stripe balance. Stripe then controls availability and the later bank payout."],
  ["What counts as a qualified provider?", "A qualified provider must be genuinely new, complete provider onboarding, publish a legitimate active listing, and complete an eligible paid booking. The provider payout must succeed, and the booking cannot have a disqualifying refund, dispute, chargeback, or fraud concern."],
  ["How long do I earn from a referred provider?", "The Standard Partner Program currently pays eligible revenue share for six months. That period begins when the provider qualifies through their first eligible completed and paid booking. Partners with approved custom compensation settings should refer to the terms shown in their dashboard."],
  ["How does referral tracking work?", "A valid link from an active partner records the referral and saves a first-party referral cookie for the program's attribution window, currently 60 days for the standard program. A later valid partner link replaces the earlier one. A valid code entered during provider onboarding intentionally overrides the saved link. The referral token is consumed and attribution locks when the new provider profile is created."],
  ["Do I need to be a BubsBookings provider?", "No. Creators, community leaders, agencies, and affiliates may apply without offering services on BubsBookings. Self-referrals and duplicate or controlled provider accounts are not eligible."],
  ["What happens if a booking is refunded or disputed?", "The related commission may be held, reduced, rejected, or reversed. BubsBookings keeps the financial history rather than silently deleting the original ledger entry."],
  ["What are Provider Growth Milestones?", "Partners in the Standard Partner Program can earn cumulative bonuses after 10, 25, 50, and 100 referred providers each become an Active Provider. An Active Provider must complete four qualified paid bookings after the normal refund, dispute, chargeback, fraud, payout-release, and holding checks. Custom partnerships include milestones only when they are enabled in the Partner's approved terms."],
  ["Can larger creators discuss a custom partnership?", "Yes. Established creators can request a different structure in the Partner application. Custom agreements include Provider Growth Milestones only when the approved program terms explicitly enable them. A request does not promise approval, an upfront sponsorship, guaranteed payment, or a specific rate."],
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

    <section className="partners-hero overflow-hidden bg-[radial-gradient(circle_at_80%_10%,#d9e9d5,transparent_38%),linear-gradient(135deg,#f8f7f3,#f0f4ea)]"><div className="site-container grid gap-10 px-5 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#64786d]">BubsBookings partner program</p><h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-6xl">Help local providers grow. Earn when they succeed.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">For creators, community leaders, agencies, and affiliates who can introduce legitimate service providers to BubsBookings.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"><a href="#apply" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-7 py-3.5 font-bold shadow-[0_10px_30px_rgba(202,185,42,.22)]">Apply to become a partner</a><Link href="/affiliate" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-6 py-3.5 font-bold">Already a partner? Sign in</Link></div></div>
      <aside className="partners-program-card rounded-[2rem] bg-[#123d2e] p-7 text-white shadow-xl" aria-labelledby="standard-partner-program-heading"><p id="standard-partner-program-heading" className="text-xs font-bold uppercase tracking-[.16em] text-[#a9c3b4]">Standard Partner Program</p><p className="partners-standard-intro mt-3 text-sm leading-6 text-[#d8e3dd]">Most Partners start with the standard program below. Some Partners may have custom compensation terms.</p><div className="partners-compensation-grid mt-5 grid gap-4 sm:grid-cols-2"><div><p className="partners-compensation-value text-4xl font-bold">$10</p><p className="mt-1 text-sm leading-6 text-[#c7d7cf]">Activation bonus when a referred provider completes their first qualified paid booking.</p></div><div><p className="partners-compensation-value text-4xl font-bold">20%</p><p className="mt-1 text-sm leading-6 text-[#c7d7cf]">Of eligible BubsBookings provider marketplace fee revenue for 6 months—not 20% of the provider&apos;s service price.</p></div></div><div className="partners-example mt-5 rounded-2xl bg-[#eee25a] p-5 text-[#183126]"><p className="text-xs font-bold uppercase tracking-[.14em]">Simple example</p><p className="mt-2 text-sm leading-6">A provider completes a <strong>$250 booking</strong>. If BubsBookings earns a <strong>$25 provider fee</strong>, your 20% share is <strong>$5</strong>.</p><p className="mt-2 text-sm leading-6">If it is the provider&apos;s first qualified booking, you also earn the <strong>$10 activation bonus</strong>.</p></div><p className="partners-custom-note mt-4 border-t border-white/15 pt-4 text-xs font-bold leading-5 text-[#e4ece7]">Standard terms apply unless your Partner account has custom compensation settings.</p><p className="partners-payout-note mt-2 text-xs leading-5 text-[#c5d4cc]">Earnings become payable after the required hold period. Refunds, disputes, or chargebacks may reduce or reverse earnings.</p><PartnerTermsLink /></aside>
    </div></section>

    <section className="site-container px-5 py-14"><div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Who this is for</p><h2 className="mt-2 text-3xl font-bold tracking-tight">A strong fit for practical business creators</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[#61736a]">The program works best when your audience includes people who provide—or want to start providing—real local services.</p><div className="mt-5 flex flex-wrap gap-2">{audienceTopics.map(topic => <span key={topic} className="rounded-full border border-[#183126]/10 bg-white px-4 py-2 text-sm font-bold">{topic}</span>)}</div></div><aside className="rounded-[2rem] bg-[#e6eee1] p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#63756b]">Have a different partnership idea?</p><h2 className="mt-2 text-2xl font-bold">Request a custom partnership</h2><p className="mt-3 text-sm leading-7 text-[#5d7066]">Most Partners use the standard program. If you have a larger audience, newsletter, website, community, or another promotion idea, request a custom partnership in the application. A request does not guarantee sponsorship, payment, a higher rate, or approval.</p><a href="#apply" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Request in application</a></aside></div></section>

    <section className="site-container px-5 py-14"><h2 className="text-3xl font-bold tracking-tight">How referrals become payable</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{steps.map(([stepTitle, body], index) => <article key={stepTitle} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eee25a] text-sm font-bold">{index + 1}</span><h3 className="mt-4 text-xl font-bold">{stepTitle}</h3><p className="mt-2 text-sm leading-6 text-[#687970]">{body}</p></article>)}</div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2"><section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7"><h2 className="text-2xl font-bold">What counts as qualified</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-[#5d7066]"><li>✓ A genuinely new provider account</li><li>✓ Completed provider onboarding and an active legitimate listing</li><li>✓ A real paid booking that is completed</li><li>✓ The provider&apos;s eligible payout was successfully released</li><li>✓ No disqualifying refund, dispute, chargeback, or fraud concern</li><li>✓ The applicable commission holding period has passed</li></ul></section><section className="rounded-[2rem] border border-[#183126]/10 bg-[#f3f0b2]/35 p-7"><h2 className="text-2xl font-bold">Clear promotion rules</h2><p className="mt-4 text-sm leading-7 text-[#5d7066]">Always disclose that you may earn compensation. Do not promise provider earnings, misrepresent BubsBookings, bid on protected brand terms, impersonate another Partner, create self-referrals, or encourage fake bookings. BubsBookings may review, hold, reverse, or reject commissions tied to ineligible activity.</p></section></div>
      <section className="mt-10 rounded-[2rem] bg-[#153d2e] p-6 text-white sm:p-8" aria-labelledby="growth-bonuses-heading"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#b9cfc3]">Standard Partner Program</p><h2 id="growth-bonuses-heading" className="mt-2 text-3xl font-bold">Provider Growth Bonuses</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-[#d4e1da]">Build lasting provider success, not just signups. A referred provider becomes an Active Provider after four qualified paid bookings clear the normal payout-release, refund, dispute, chargeback, fraud, and holding checks.</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{STANDARD_PROVIDER_GROWTH_MILESTONES.map((milestone,index)=><article key={milestone.threshold} className="rounded-2xl border border-white/15 bg-white/8 p-5"><p className="text-3xl font-bold">{milestone.threshold}</p><p className="text-xs font-bold uppercase tracking-wider text-[#b9cfc3]">Active Providers</p><p className="mt-4 text-xl font-bold">{index===0?"":"+"}${milestone.bonusCents/100}</p></article>)}</div><p className="mt-5 text-xs leading-6 text-[#b9cfc3]">Bonuses are cumulative—$900 total after all four milestones—and are separate from activation bonuses and revenue share. Custom programs include them only when explicitly enabled in the approved terms. Eligibility may be reversed if an underlying booking later becomes ineligible.</p></section>
    </section>

    <section className="site-container px-5 pb-14"><div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Partner program FAQ</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Questions before you apply</h2><div className="mt-6 divide-y divide-[#183126]/10">{faqs.map(([question, answer]) => <details key={question} className="group py-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-bold marker:content-none">{question}<span aria-hidden="true" className="text-xl transition group-open:rotate-45">+</span></summary><p className="max-w-4xl pb-2 pr-8 text-sm leading-7 text-[#61736a]">{answer}</p></details>)}</div></div></section>

    <section id="apply" className="site-container scroll-mt-6 px-5 pb-16"><PartnerApplicationForm /></section>
  </main>;
}
