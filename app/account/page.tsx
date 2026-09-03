"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import FavoriteButton from "@/components/favorite-button";
import NotificationBell from "@/components/notification-bell";

type BookingState = "confirmed" | "requested" | "completed" | "cancelled";

type Booking = { id: string; serviceId: string; providerId: string; service: string; serviceSlug: string; category: string; provider: string; startsAt: string; price: number; location: string; state: BookingState };
type SavedService = { id: string; slug: string; title: string; provider: string; price: number; category: string; city: string; state: string; imageUrls: string[] };

const initialBookings: Booking[] = [];
const serviceVisuals: Record<string, { art: string; gradient: string }> = {
  "Car detailing": { art: "🚙", gradient: "from-emerald-900 via-emerald-700 to-lime-300" },
  "Lawn & garden": { art: "🌱", gradient: "from-lime-700 via-lime-500 to-yellow-200" },
  "Home cleaning": { art: "🏡", gradient: "from-orange-800 via-orange-500 to-orange-200" },
  Handyman: { art: "🧰", gradient: "from-slate-800 via-slate-600 to-amber-200" },
  Photography: { art: "📷", gradient: "from-violet-900 via-purple-600 to-pink-200" },
};

export default function AccountPage() {
  const { data: session } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"bookings" | "saved">("bookings");
  const [bookings, setBookings] = useState(initialBookings);
  const [toast, setToast] = useState("");
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/providers/me").then((response) => {
      if (active && response.ok) setHasProviderProfile(true);
    });
    fetch("/api/favorites")
      .then(async (response) => response.ok ? response.json() as Promise<{ services: SavedService[] }> : null)
      .then((data) => { if (active && data) setSavedServices(data.services); });
    fetch("/api/bookings")
      .then(async (response) => response.ok ? response.json() as Promise<{ bookings: Booking[] }> : null)
      .catch(() => null)
      .then((data) => { if (active && data) setBookings(data.bookings); });
    return () => { active = false; };
  }, []);

  async function cancelBooking(id: string) {
    const response = await fetch(`/api/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }).catch(() => null);
    if (!response) {
      setToast("We could not cancel that booking. Please try again.");
      return;
    }
    if (!response.ok) {
      setToast("We could not cancel that booking. Please try again.");
      return;
    }
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
  const bookingVisual = (category: string) => {
    const normalized = category.toLowerCase();
    if (normalized.includes("car")) return "🚙";
    if (normalized.includes("lawn") || normalized.includes("garden") || normalized.includes("landscap")) return "🌱";
    if (normalized.includes("clean")) return "🏡";
    if (normalized.includes("handyman")) return "🧰";
    if (normalized.includes("photo")) return "📷";
    return "✨";
  };
  const bookingDate = (startsAt: string) => new Date(startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const bookingTime = (startsAt: string) => new Date(startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex"><Link href="/services" className="hover:text-[#5b7365]">Explore services</Link><Link href="/providers/join" className="hover:text-[#5b7365]">List your service</Link></nav>
          <div className="flex items-center gap-2 sm:gap-3"><Link href={isProvider ? "/provider/dashboard" : "/providers/join"} className="rounded-full border border-[#183126]/15 bg-[#faf9f5] px-4 py-2.5 text-xs font-bold transition hover:border-[#4d725d] hover:bg-[#dfead9] sm:text-sm">↔ <span className="hidden sm:inline">{isProvider ? "Switch to " : "Become a "}</span>provider</Link><NotificationBell /><div aria-label={`${accountName ?? "BookMe"} account`} className="grid h-10 w-10 place-items-center rounded-full bg-[#e6eedf] text-sm font-bold">{initials}</div></div>
        </div>
      </header>

      {toast && <div role="status" className="fixed right-5 top-20 z-50 flex max-w-sm items-start gap-3 rounded-2xl bg-[#183126] p-4 text-sm text-white shadow-2xl"><span className="text-[#eee25a]">✓</span><p className="font-semibold">{toast}</p><button onClick={() => setToast("")} aria-label="Dismiss" className="ml-2 rounded-full px-2 text-white/60 transition hover:bg-white/15 hover:text-white">×</button></div>}

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-[#687a70]">Customer account</p><h1 className="mt-1 text-4xl font-bold tracking-[-.045em]">Hi, {firstName}.</h1><p className="mt-2 text-[#687a70]">Keep track of your bookings and favorite local pros.</p></div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto"><Link href="/account/messages" className="rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]">✉ Messages</Link><Link href="/services" className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5">+ Book a service</Link></div>
        </div>

        <div className="mt-9 flex gap-2 border-b border-[#183126]/10">
          <button onClick={() => setActiveTab("bookings")} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition hover:bg-[#e3ecdE] ${activeTab === "bookings" ? "border-[#183126] text-[#183126]" : "border-transparent text-[#77857e]"}`}>My bookings <span className="ml-1 rounded-full bg-[#e8ece7] px-2 py-0.5 text-[10px]">{upcoming.length}</span></button>
          <button onClick={() => setActiveTab("saved")} className={`rounded-t-xl border-b-2 px-4 py-3 text-sm font-bold transition hover:bg-[#e3ecde] ${activeTab === "saved" ? "border-[#183126] text-[#183126]" : "border-transparent text-[#77857e]"}`}>Saved services <span className="ml-1 rounded-full bg-[#e8ece7] px-2 py-0.5 text-[10px]">{savedServices.length}</span></button>
        </div>

        {activeTab === "bookings" ? <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex items-center justify-between"><h2 className="text-2xl font-bold tracking-tight">Coming up</h2><p className="text-sm text-[#75847d]">{upcoming.length} active</p></div>
            <div className="mt-5 space-y-4">
              {upcoming.length ? upcoming.map((booking) => <article key={booking.id} className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_5px_22px_rgba(24,49,38,.05)] sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#d8e7d3] to-[#f0e66d] text-4xl">{bookingVisual(booking.category)}</span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${booking.state === "confirmed" ? "bg-[#e3f1e5] text-[#34704a]" : "bg-[#fff1bf] text-[#7e681b]"}`}>{booking.state === "confirmed" ? "Confirmed" : "Awaiting provider"}</span></div><h3 className="mt-2 text-lg font-bold">{booking.service}</h3><p className="mt-1 text-sm text-[#6e7d75]">{booking.provider}</p></div>
                  <div className="sm:text-right"><p className="font-bold">{bookingDate(booking.startsAt)}</p><p className="mt-1 text-sm text-[#708078]">{bookingTime(booking.startsAt)} · ${booking.price}</p><p className="mt-1 text-xs text-[#89958f]">{booking.location}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#183126]/10 pt-4"><button onClick={() => cancelBooking(booking.id)} className="rounded-full px-4 py-2 text-xs font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">Cancel</button><button onClick={() => requestReschedule(booking.service)} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#eee25a]">Reschedule</button><Link href={`/account/messages?providerId=${booking.providerId}&serviceId=${booking.serviceId}`} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">✉ Message provider</Link><Link href={`/services/${booking.serviceSlug}`} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#315846]">View details</Link></div>
              </article>) : <div className="rounded-[2rem] bg-white p-12 text-center"><p className="text-3xl">📅</p><h3 className="mt-3 font-bold">Nothing on the calendar</h3><Link href="/services" className="mt-4 inline-block text-sm font-bold underline">Find a service</Link></div>}
            </div>

            <h2 className="mt-10 text-xl font-bold tracking-tight">History</h2>
            <div className="mt-4 divide-y divide-[#183126]/10 rounded-2xl border border-[#183126]/10 bg-white px-5">{history.length > 0 ? history.map((booking) => <div key={booking.id} className="flex items-center gap-4 py-4"><span className="text-2xl grayscale">{bookingVisual(booking.category)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{booking.service}</p><p className="text-xs text-[#7a8881]">{booking.provider} · {bookingDate(booking.startsAt)}</p></div><span className={`text-xs font-bold capitalize ${booking.state === "cancelled" ? "text-[#9a5a47]" : "text-[#5c7766]"}`}>{booking.state}</span></div>) : <p className="py-5 text-sm text-[#7a8881]">Completed and cancelled bookings will appear here.</p>}</div>
          </div>

          <aside><div className="rounded-[2rem] bg-[#183126] p-6 text-white"><span className="text-3xl">☂</span><h2 className="mt-4 text-xl font-bold">You&apos;re covered.</h2><p className="mt-2 text-sm leading-6 text-[#b7c6be]">Every booking includes our BookMe Promise, with vetted providers and support when you need it.</p><button className="mt-5 rounded-full px-3 py-2 text-sm font-bold text-[#eee25a] transition hover:bg-white/15">Learn more →</button></div><div className="mt-4 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#74837b]">Need help?</p><p className="mt-3 text-sm leading-6 text-[#65766d]">Our support team is here seven days a week.</p><button className="mt-4 rounded-full px-3 py-2 text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">Contact support</button></div></aside>
        </div> : <div className="mt-8">
          <div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Saved services</h2><p className="mt-1 text-sm text-[#728179]">Your shortlist of local favorites.</p></div><Link href="/services" className="text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">Explore more</Link></div>
          {savedServices.length > 0 ? <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{savedServices.map((service) => {
            const visual = serviceVisuals[service.category] ?? { art: "✨", gradient: "from-emerald-800 to-lime-200" };
            return <article key={service.id} className="group relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition hover:-translate-y-1">
              <Link href={`/services/${service.slug}`} className="block">
                <div style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative h-52 bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{!service.imageUrls[0] && <span className="absolute bottom-5 right-6 text-6xl opacity-80">{visual.art}</span>}</div>
                <div className="p-5"><div className="flex justify-between gap-4 text-sm"><span className="font-semibold text-[#64776d]">📍 {service.city}, {service.state}</span><span className="shrink-0 font-bold">From ${service.price}</span></div><h3 className="mt-3 text-lg font-bold">{service.title}</h3><p className="mt-1 text-sm text-[#718078]">{service.provider}</p></div>
              </Link>
              <FavoriteButton serviceId={service.id} serviceTitle={service.title} onChange={(saved) => { if (!saved) setSavedServices((current) => current.filter((item) => item.id !== service.id)); }} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#b54e46] shadow-sm" />
            </article>;
          })}</div> : <div className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-12 text-center"><p className="text-3xl">♡</p><h3 className="mt-3 font-bold">No saved services yet</h3><p className="mt-2 text-sm text-[#728179]">Services you save will appear here.</p><Link href="/services" className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">Find services</Link></div>}
        </div>}
      </div>
    </main>
  );
}
