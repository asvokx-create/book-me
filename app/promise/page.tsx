import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/account-nav";

export const metadata: Metadata = {
  title: "BubsBookings Promise",
  description: "Learn how BubsBookings helps protect your booking, payment, communication, and support experience.",
};

const protections = [
  ["Provider checks", "Provider profiles display completed verification signals so you can make a more informed choice before booking."],
  ["Secure payments", "Payments are handled by Stripe. Providers do not receive your full card information, and payment records stay connected to your booking."],
  ["Everything in one place", "Keep booking details, schedule changes, messages, and status updates together so both sides have a clear record."],
  ["Help when something goes wrong", "You can contact BubsBookings support, report a concern, request a refund, or open a dispute from your account."],
] as const;

export default function PromisePage() {
  return <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
    <header className="border-b border-[#183126]/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link>
        <AccountNav />
      </div>
    </header>

    <section className="relative overflow-hidden bg-[#183126] text-white">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#557861]/35 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <span className="text-5xl">☂</span>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.17em] text-[#c7d5cd]">The BubsBookings Promise</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">More confidence from booking to completion.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#c3d0c9]">We give customers clear provider information, secure payment tools, organized communication, and a direct path to support.</p>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="grid gap-5 sm:grid-cols-2">
        {protections.map(([title, description], index) => <article key={title} className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_8px_30px_rgba(24,49,38,.05)] sm:p-8"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#eee25a] font-black">{index + 1}</span><h2 className="mt-5 text-2xl font-bold tracking-tight">{title}</h2><p className="mt-3 text-sm leading-7 text-[#61736a]">{description}</p></article>)}
      </div>

      <div className="mt-8 rounded-[2rem] bg-[#e7eee2] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
        <div><h2 className="text-2xl font-bold">Need help with a booking?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#61736a]">Open the booking from your account to message the provider, manage changes, request a refund, or contact support.</p></div>
        <Link href="/account" className="mt-5 inline-flex shrink-0 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846] sm:mt-0">Go to my bookings →</Link>
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-[#718078]">The BubsBookings Promise supports a safer, clearer marketplace experience. It is not insurance, a background check, or a guarantee of a provider&apos;s work. Review each provider&apos;s profile, service details, and policies before booking.</p>
    </section>
  </main>;
}
