import type { Metadata } from "next";
import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import MobileSiteNav from "@/components/mobile-site-nav";
import PartnerApplicationForm from "@/components/partner-application-form";

export const metadata: Metadata = { title: "Creator and affiliate partners", description: "Apply to promote BubsBookings and earn for qualified provider referrals." };

const steps = [
  ["Share BubsBookings", "Use your unique referral link or creator code in disclosed, accurate content."],
  ["A provider gets established", "The new provider completes onboarding, publishes a legitimate listing, and completes an eligible paid booking."],
  ["Commissions clear", "Eligible commission remains on hold through the program's refund and dispute period, then becomes payable."],
];

export default function PartnersPage() {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
    <header className="border-b border-[#183126]/10 bg-white/90"><div className="site-container flex items-center justify-between px-5 py-4"><Link href="/"><BrandLockup /></Link><div className="flex items-center gap-3"><Link href="/affiliate" className="hidden rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold sm:inline-flex">Partner dashboard</Link><MobileSiteNav /></div></div></header>
    <section className="overflow-hidden bg-[radial-gradient(circle_at_80%_10%,#d9e9d5,transparent_38%),linear-gradient(135deg,#f8f7f3,#f0f4ea)]"><div className="site-container grid gap-10 px-5 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#64786d]">BubsBookings partner program</p><h1 className="mt-4 text-4xl font-bold tracking-[-.055em] sm:text-6xl">Help local providers grow. Earn when they succeed.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">For creators, community leaders, agencies, and affiliates who can introduce legitimate service providers to BubsBookings.</p><div className="mt-7 flex flex-wrap gap-3"><a href="#apply" className="rounded-full bg-[#eee25a] px-6 py-3.5 font-bold">Apply now</a><Link href="/affiliate" className="rounded-full border border-[#183126]/15 bg-white px-6 py-3.5 font-bold">Open dashboard</Link></div></div>
      <aside className="rounded-[2rem] bg-[#123d2e] p-7 text-white shadow-xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9c3b4]">Standard creator program</p><p className="mt-4 text-4xl font-bold">$10</p><p className="mt-1 text-sm text-[#c7d7cf]">activation bonus for a qualified referred provider</p><p className="mt-6 text-4xl font-bold">20%</p><p className="mt-1 text-sm leading-6 text-[#c7d7cf]">of eligible BubsBookings provider marketplace fee revenue for 6 months—not 20% of the provider&apos;s service price.</p><p className="mt-5 rounded-2xl bg-white/8 p-4 text-xs leading-5 text-[#d8e3dd]">Program terms are snapshotted when a provider is attributed. Qualification and payout timing remain subject to the active program and partner agreement.</p></aside>
    </div></section>
    <section className="site-container px-5 py-14"><h2 className="text-3xl font-bold tracking-tight">How referrals become payable</h2><div className="mt-7 grid gap-4 md:grid-cols-3">{steps.map(([title, body], index) => <article key={title} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eee25a] text-sm font-bold">{index + 1}</span><h3 className="mt-4 text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#687970]">{body}</p></article>)}</div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2"><section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7"><h2 className="text-2xl font-bold">What counts as qualified</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-[#5d7066]"><li>✓ A genuinely new provider account</li><li>✓ Completed provider onboarding and an active legitimate listing</li><li>✓ A real paid booking that is completed</li><li>✓ No disqualifying refund, dispute, chargeback, or fraud concern</li><li>✓ The applicable commission holding period has passed</li></ul></section><section className="rounded-[2rem] border border-[#183126]/10 bg-[#f3f0b2]/35 p-7"><h2 className="text-2xl font-bold">Clear promotion rules</h2><p className="mt-4 text-sm leading-7 text-[#5d7066]">Always disclose that you may earn compensation. Do not promise provider earnings, misrepresent BubsBookings, bid on protected brand terms, impersonate another creator, create self-referrals, or encourage fake bookings. BubsBookings may review, hold, reverse, or reject commissions tied to ineligible activity.</p></section></div>
    </section>
    <section id="apply" className="site-container px-5 pb-16"><PartnerApplicationForm /></section>
  </main>;
}
