import BrandLockup from "@/components/brand-lockup";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Support",
  description: "Contact BubsBookings for account, booking, payment, safety, privacy, or partner-program support.",
  alternates: { canonical: "/support" },
};

const supportTopics = [
  ["Account or booking help", "Include the email on your account and the booking or request ID when available."],
  ["Payment or payout help", "Include the relevant booking, provider, or partner payout reference. Never email full card or bank details."],
  ["Privacy or legal request", "Describe the access, correction, deletion, export, appeal, or other request you want BubsBookings to review."],
  ["Safety concern", "If anyone is in immediate danger, contact emergency services first. Then share the relevant account or booking details with BubsBookings."],
] as const;

export default function SupportPage() {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
    <header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><Link href="/" aria-label="BubsBookings home"><BrandLockup compact /></Link><Link href="/" className="site-nav-link">Back home</Link></div></header>
    <section className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-[#687b70]">Trust &amp; support</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">How can we help?</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5d7066]">Send BubsBookings the information needed to investigate while keeping passwords, authentication codes, full payment-card numbers, and bank credentials out of email.</p>
      <a href="mailto:christian@bubsbookings.com?subject=BubsBookings%20support%20request" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-7 py-3.5 font-bold shadow-[0_10px_30px_rgba(202,185,42,.22)]">Email support</a>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">{supportTopics.map(([title, description]) => <article key={title} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#61736a]">{description}</p></article>)}</div>
      <nav aria-label="More help" className="mt-10 flex flex-wrap gap-3"><Link href="/disputes" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Disputes</Link><Link href="/content-removal" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Content removal</Link><Link href="/privacy" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Privacy</Link><Link href="/accessibility" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold">Accessibility</Link></nav>
    </section>
  </main>;
}
