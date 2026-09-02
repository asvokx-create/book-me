"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type BookingState = "confirmed" | "requested" | "completed" | "cancelled";

type Booking = { id: number; service: string; provider: string; date: string; time: string; price: number; location: string; art: string; state: BookingState };
type SavedService = { slug: string; title: string; provider: string; price: number; rating: string; art: string; gradient: string };

const initialBookings: Booking[] = [];
const savedServices: SavedService[] = [];

export default function AccountPage() {
  const { data: session } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"bookings" | "saved">("bookings");
  const [bookings, setBookings] = useState(initialBookings);
  const [toast, setToast] = useState("");
  const [hasProviderProfile, setHasProviderProfile] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/providers/me").then((response) => {
      if (active && response.ok) setHasProviderProfile(true);
    });
    return () => { active = false; };
  }, []);

  function cancelBooking(id: number) {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, state: "cancelled" as BookingState } : booking));
    setToast("Booking cancelled. No charge was made.");
  }

  function requestReschedule(service: string) {
    setToast(`Reschedule options requested for ${service}.`);
  }

  const upcoming = bookings.filter((booking) => booking.state !== "completed" && booking.state !== "cancelled");
  const history = bookings.filter((booking) => booking.state === "completed" || booking.state === "cancelled");
  const accountName = session?.user.name?.trim();
  const firstName = accountName?.split(/\s+/)[0] ?? "there";
  const initials = accountName
    ? accountName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : "B";
  const isProvider = hasProviderProfile || (session?.user as { role?: string } | undefined)?.role === "provider";

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex"><Link href="/services" className="hover:text-[#5b7365]">Explore services</Link><Link href="/providers/join" className="hover:text-[#5b7365]">List your service</Link></nav>
          <div className="flex items-center gap-2 sm:gap-3"><Link href={isProvider ? "/provider/dashboard" : "/providers/join"} className="rounded-full border border-[#183126]/15 bg-[#faf9f5] px-4 py-2.5 text-xs font-bold transition hover:border-[#4d725d] hover:bg-white sm:text-sm">↔ <span className="hidden sm:inline">{isProvider ? "Switch to " : "Become a "}</span>provider</Link><button aria-label="Notifications" className="relative hidden h-10 w-10 place-items-center rounded-full border border-[#183126]/10 bg-[#faf9f5] sm:grid">🔔<span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#d45f40]" /></button><div aria-label={`${accountName ?? "BookMe"} account`} className="grid h-10 w-10 place-items-center rounded-full bg-[#e6eedf] text-sm font-bold">{initials}</div></div>
        </div>
      </header>

      {toast && <div role="status" className="fixed right-5 top-20 z-50 flex max-w-sm items-start gap-3 rounded-2xl bg-[#183126] p-4 text-sm text-white shadow-2xl"><span className="text-[#eee25a]">✓</span><p className="font-semibold">{toast}</p><button onClick={() => setToast("")} aria-label="Dismiss" className="ml-2 text-white/60">×</button></div>}

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-[#687a70]">Customer account</p><h1 className="mt-1 text-4xl font-bold tracking-[-.045em]">Hi, {firstName}.</h1><p className="mt-2 text-[#687a70]">Keep track of your bookings and favorite local pros.</p></div>
          <Link href="/services" className="self-start rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 sm:self-auto">+ Book a service</Link>
        </div>

        <div className="mt-9 flex gap-2 border-b border-[#183126]/10">
          <button onClick={() => setActiveTab("bookings")} className={`border-b-2 px-4 py-3 text-sm font-bold transition ${activeTab === "bookings" ? "border-[#183126] text-[#183126]" : "border-transparent text-[#77857e]"}`}>My bookings <span className="ml-1 rounded-full bg-[#e8ece7] px-2 py-0.5 text-[10px]">{upcoming.length}</span></button>
          <button onClick={() => setActiveTab("saved")} className={`border-b-2 px-4 py-3 text-sm font-bold transition ${activeTab === "saved" ? "border-[#183126] text-[#183126]" : "border-transparent text-[#77857e]"}`}>Saved services <span className="ml-1 rounded-full bg-[#e8ece7] px-2 py-0.5 text-[10px]">{savedServices.length}</span></button>
        </div>

        {activeTab === "bookings" ? <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">Coming up</h2><p className="text-sm text-[#75847d]">{upcoming.length} active</p></div>
            <div className="mt-5 space-y-4">
              {upcoming.length ? upcoming.map((booking) => <article key={booking.id} className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_5px_22px_rgba(24,49,38,.05)] sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#d8e7d3] to-[#f0e66d] text-4xl">{booking.art}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${booking.state === "confirmed" ? "bg-[#e3f1e5] text-[#34704a]" : "bg-[#fff1bf] text-[#7e681b]"}`}>{booking.state === "confirmed" ? "Confirmed" : "Awaiting provider"}</span></div><h3 className="mt-2 text-lg font-bold">{booking.service}</h3><p className="mt-1 text-sm text-[#6e7d75]">{booking.provider}</p></div>
                  <div className="sm:text-right"><p className="font-bold">{booking.date}</p><p className="mt-1 text-sm text-[#708078]">{booking.time} · ${booking.price}</p><p className="mt-1 text-xs text-[#89958f]">{booking.location}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#183126]/10 pt-4"><button onClick={() => cancelBooking(booking.id)} className="rounded-full px-4 py-2 text-xs font-bold text-[#8a4c3a] hover:bg-[#fff2ed]">Cancel</button><button onClick={() => requestReschedule(booking.service)} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold hover:bg-[#f6f5f0]">Reschedule</button><Link href={`/services/${booking.id === 2 ? "premium-car-detail" : "deep-home-cleaning"}`} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">View details</Link></div>
              </article>) : <div className="rounded-[2rem] bg-white p-12 text-center"><p className="text-3xl">📅</p><h3 className="mt-3 font-bold">Nothing on the calendar</h3><Link href="/services" className="mt-4 inline-block text-sm font-bold underline">Find a service</Link></div>}
            </div>

            <h2 className="mt-10 text-xl font-bold tracking-tight">History</h2>
            <div className="mt-4 divide-y divide-[#183126]/10 rounded-2xl border border-[#183126]/10 bg-white px-5">{history.length > 0 ? history.map((booking) => <div key={booking.id} className="flex items-center gap-4 py-4"><span className="text-2xl grayscale">{booking.art}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{booking.service}</p><p className="text-xs text-[#7a8881]">{booking.provider} · {booking.date}</p></div><span className={`text-xs font-bold capitalize ${booking.state === "cancelled" ? "text-[#9a5a47]" : "text-[#5c7766]"}`}>{booking.state}</span></div>) : <p className="py-5 text-sm text-[#7a8881]">Completed and cancelled bookings will appear here.</p>}</div>
          </div>

          <aside><div className="rounded-[2rem] bg-[#183126] p-6 text-white"><span className="text-3xl">☂</span><h2 className="mt-4 text-xl font-bold">You&apos;re covered.</h2><p className="mt-2 text-sm leading-6 text-[#b7c6be]">Every booking includes our BookMe Promise, with vetted providers and support when you need it.</p><button className="mt-5 text-sm font-bold text-[#eee25a]">Learn more →</button></div><div className="mt-4 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#74837b]">Need help?</p><p className="mt-3 text-sm leading-6 text-[#65766d]">Our support team is here seven days a week.</p><button className="mt-4 text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">Contact support</button></div></aside>
        </div> : <div className="mt-8">
          <div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Saved services</h2><p className="mt-1 text-sm text-[#728179]">Your shortlist of local favorites.</p></div><Link href="/services" className="text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">Explore more</Link></div>
          {savedServices.length > 0 ? <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{savedServices.map((service) => <Link key={service.slug} href={`/services/${service.slug}`} className="group overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition hover:-translate-y-1"><div className={`relative h-52 bg-gradient-to-br ${service.gradient}`}><span className="absolute bottom-5 right-6 text-6xl opacity-80">{service.art}</span><span className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white text-lg text-[#b54e46] shadow-sm">♥</span></div><div className="p-5"><div className="flex justify-between text-sm"><span className="font-bold text-[#c88f28]">★ {service.rating}</span><span className="font-bold">From ${service.price}</span></div><h3 className="mt-3 text-lg font-bold">{service.title}</h3><p className="mt-1 text-sm text-[#718078]">{service.provider}</p></div></Link>)}</div> : <div className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-12 text-center"><p className="text-3xl">♡</p><h3 className="mt-3 font-bold">No saved services yet</h3><p className="mt-2 text-sm text-[#728179]">Services you save will appear here.</p></div>}
        </div>}
      </div>
    </main>
  );
}
