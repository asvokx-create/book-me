"use client";

import BrandLockup from "@/components/brand-lockup";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import FavoriteButton from "@/components/favorite-button";
import NotificationBell from "@/components/notification-bell";
import ProfileAvatar from "@/components/profile-avatar";
import ContactSupportButton from "@/components/contact-support-button";
import { formatInUserTimeZone, useUserTimeZone } from "@/components/preferences-provider";
import AccountLocationReminder from "@/components/account-location-reminder";
import UiIcon from "@/components/ui-icon";
import ServiceCategoryIcon from "@/components/service-category-icon";
import { formatServicePrice } from "@/lib/service-pricing";

type BookingState = "confirmed" | "requested" | "completed" | "cancelled";

type Booking = { id: string; serviceId: string; providerId: string; service: string; serviceSlug: string; category: string; provider: string; startsAt: string; price: number; location: string; deliveryMethod: "IN_PERSON" | "REMOTE"; state: BookingState; assigneeName: string };
type SavedService = { id: string; slug: string; title: string; provider: string; price: number; pricingType: "FIXED" | "HOURLY"; hourlyRateCents: number | null; category: string; city: string; state: string; deliveryType: "IN_PERSON" | "REMOTE" | "BOTH"; imageUrls: string[] };

const initialBookings: Booking[] = [];
const serviceVisuals: Record<string, { gradient: string }> = {
  "Car detailing": { gradient: "from-[#dcecf1] to-[#e5efd8]" },
  "Lawn & garden": { gradient: "from-[#e2f0d2] to-[#f5efc1]" },
  "Home cleaning": { gradient: "from-[#dff1e5] to-[#f6f3c7]" },
  "Pressure washing": { gradient: "from-[#dcecf1] to-[#e5eee4]" },
  Handyman: { gradient: "from-[#eee5d9] to-[#f7efc8]" },
  "Furniture assembly": { gradient: "from-[#eee5d9] to-[#f6efc8]" },
  "House painting": { gradient: "from-[#e5eee4] to-[#f3edcf]" },
  Photography: { gradient: "from-[#e5eee4] to-[#f3edcf]" },
  "Pet care": { gradient: "from-[#e8efe1] to-[#f6efc8]" },
  "Moving help": { gradient: "from-[#dcecf1] to-[#e5efd8]" },
  "Junk removal": { gradient: "from-[#dfeae2] to-[#f2edc8]" },
  Tutoring: { gradient: "from-[#e5eee4] to-[#f6efc8]" },
  "Tech help": { gradient: "from-[#dcecf1] to-[#e5eee4]" },
};

export default function AccountPage() {
  const timeZone = useUserTimeZone();
  const { data: session } = authClient.useSession();
  const [activeTab, setActiveTab] = useState<"bookings" | "saved">("bookings");
  const [bookings, setBookings] = useState(initialBookings);
  const [toast, setToast] = useState("");
  const [hasProviderProfile, setHasProviderProfile] = useState(false);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [workerCompany, setWorkerCompany] = useState<{ businessName: string; teamRole: string } | null>(null);
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);

  useEffect(() => {
    let active = true;
    async function loadCompany() {
      try {
        const response = await fetch("/api/providers/me", { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (!active) return;
        setHasProviderProfile(Boolean(data));
        setWorkerCompany(data?.accessRole === "worker" ? { businessName: data.businessName, teamRole: data.teamRole } : null);
      } catch { /* Keep the customer's account usable if the company lookup fails. */ }
    }
    void loadCompany();
    window.addEventListener("focus", loadCompany);
    fetch("/api/favorites")
      .then(async (response) => response.ok ? response.json() as Promise<{ services: SavedService[] }> : null)
      .then((data) => { if (active && data) setSavedServices(data.services); });
    fetch("/api/bookings")
      .then(async (response) => response.ok ? response.json() as Promise<{ bookings: Booking[] }> : null)
      .catch(() => null)
      .then((data) => { if (active && data) setBookings(data.bookings); });
    fetch("/api/account/navigation", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean; isAdmin: boolean }> : null)
      .then((data) => { if (active) setHasAdminAccess(Boolean(data?.authenticated && data.isAdmin)); })
      .catch(() => { if (active) setHasAdminAccess(false); });
    return () => { active = false; window.removeEventListener("focus", loadCompany); };
  }, [session?.user.id]);

  const upcoming = bookings.filter((booking) => booking.state !== "completed" && booking.state !== "cancelled");
  const history = bookings.filter((booking) => booking.state === "completed" || booking.state === "cancelled");
  const accountName = session?.user.name?.trim();
  const firstName = accountName?.split(/\s+/)[0] ?? "there";
  const isProvider = hasProviderProfile || (session?.user as { role?: string } | undefined)?.role === "provider";
  const bookingDate = (startsAt: string) => formatInUserTimeZone(startsAt, { month: "short", day: "numeric", year: "numeric" }, timeZone);
  const bookingTime = (startsAt: string) => formatInUserTimeZone(startsAt, { hour: "numeric", minute: "2-digit" }, timeZone);

  return (
    <main className="account-page min-h-screen bg-[#f5f4ef] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-white">
        <div className="dashboard-container flex items-center justify-between gap-2 px-3 py-3 sm:px-8 sm:py-4">
          <Link href="/" aria-label="BubsBookings home" className="flex min-w-0 items-center gap-2 text-lg font-bold tracking-tight sm:gap-2.5 sm:text-xl"><BrandLockup compact markOnlyOnMobile /></Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold md:flex"><Link href="/services" className="hover:text-[#5b7365]">Explore services</Link><Link href="/providers/join" className="hover:text-[#5b7365]">List your service</Link></nav>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">{hasAdminAccess && <Link href="/admin/affiliates" className="hidden whitespace-nowrap rounded-full bg-[#eee25a] px-3.5 py-2.5 text-xs font-bold shadow-sm transition hover:bg-[#f5ea6b] sm:inline-flex">Partners</Link>}<Link href={isProvider ? "/provider/dashboard" : "/providers/join"} aria-label={isProvider ? "Switch to provider" : "Become a provider"} className="whitespace-nowrap rounded-full bg-[#183126] px-3.5 py-2.5 text-[11px] font-bold text-white shadow-[0_6px_18px_rgba(24,49,38,.16)] transition hover:bg-[#315846] min-[370px]:text-xs sm:px-4 sm:text-sm">{isProvider ? "Switch to provider" : "Become a provider"}</Link><NotificationBell /><ProfileAvatar name={accountName ?? "BubsBookings"} imageUrl={session?.user.image} className="hidden h-10 w-10 text-sm md:grid" /></div>
        </div>
      </header>

      {toast && <div role="status" className="fixed right-5 top-20 z-50 flex max-w-sm items-start gap-3 rounded-2xl bg-[#183126] p-4 text-sm text-white shadow-2xl"><UiIcon name="check" className="h-4 w-4 shrink-0 text-[#eee25a]" /><p className="font-semibold">{toast}</p><button onClick={() => setToast("")} aria-label="Dismiss" className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/15 hover:text-white"><UiIcon name="close" className="h-4 w-4" /></button></div>}

      <div className="dashboard-container px-4 py-8 sm:px-8 sm:py-14">
        <AccountLocationReminder />
        {workerCompany && <section aria-label="Your company membership" className="mb-8 flex flex-col gap-5 rounded-3xl bg-[#183126] p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-[#eee25a]">You’re part of a company</p><h2 className="mt-2 break-words text-2xl font-bold">{workerCompany.businessName}</h2><p className="mt-2 text-sm text-[#c3d0c9]">Your role: {workerCompany.teamRole || "Team member"}</p><p className="mt-2 text-sm leading-6 text-[#c3d0c9]">View your assigned jobs and submit your working hours for your owner to approve.</p></div>
          <div className="flex shrink-0 flex-wrap gap-3"><Link href="/provider/dashboard" className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126]">Open my work dashboard</Link><Link href="/provider/dashboard/team" className="rounded-full border border-white/30 px-5 py-3 text-sm font-bold">My team & hours</Link></div>
        </section>}
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-semibold text-[#687a70]">Customer account</p><h1 className="mt-1 text-4xl font-bold tracking-[-.045em]">Hi, {firstName}.</h1><p className="mt-2 text-[#687a70]">Keep track of your bookings and favorite providers.</p></div>
          <div className="mobile-scroll-row -mx-4 flex w-[calc(100%+2rem)] flex-nowrap gap-2 self-start overflow-x-auto px-4 pb-2 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0 sm:pb-0 sm:self-auto">{hasAdminAccess && <Link href="/admin/affiliates" className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#315846]">Partners dashboard</Link>}<Link href="/account/requests" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]"><UiIcon name="opportunities" className="h-4 w-4" />Service requests</Link><Link href="/account/calendar" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]"><UiIcon name="calendar" className="h-4 w-4" />Calendar</Link><Link href="/account/payments" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]"><UiIcon name="card" className="h-4 w-4" />Payments</Link><Link href="/account/settings" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]"><UiIcon name="settings" className="h-4 w-4" />Settings</Link><Link href="/account/messages" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#183126]/15 bg-white px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf]"><UiIcon name="mail" className="h-4 w-4" />Messages</Link><Link href="/services" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition"><UiIcon name="plus" className="h-4 w-4" />Book a service</Link></div>
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
                  <ServiceCategoryIcon category={booking.category} className="h-20 min-h-20 w-20 min-w-20" />
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${booking.state === "confirmed" ? "bg-[#e3f1e5] text-[#34704a]" : "bg-[#fff1bf] text-[#7e681b]"}`}>{booking.state === "confirmed" ? "Confirmed" : "Awaiting provider"}</span></div><h3 className="mt-2 text-lg font-bold">{booking.service}</h3><p className="mt-1 text-sm text-[#6e7d75]">{booking.provider} · {booking.assigneeName}</p></div>
                  <div className="sm:text-right"><p className="font-bold">{bookingDate(booking.startsAt)}</p><p className="mt-1 text-sm text-[#708078]">{bookingTime(booking.startsAt)} · ${booking.price}</p><p className="mt-1 text-xs text-[#89958f]">{booking.deliveryMethod === "REMOTE" ? "Remote / online" : booking.location}</p></div>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#183126]/10 pt-4"><Link href={`/account/bookings/${booking.id}?reschedule=1`} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#eee25a]">Reschedule</Link><Link href={`/account/messages?providerId=${booking.providerId}&serviceId=${booking.serviceId}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold transition hover:bg-[#e5eddf]"><UiIcon name="mail" className="h-3.5 w-3.5" />Message provider</Link><Link href={`/account/bookings/${booking.id}`} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#315846]">Manage booking</Link></div>
              </article>) : <div className="rounded-[2rem] bg-white p-12 text-center"><UiIcon name="calendar" className="mx-auto h-8 w-8" /><h3 className="mt-3 font-bold">Nothing on the calendar</h3><Link href="/services" className="mt-4 inline-block text-sm font-bold underline">Find a service</Link></div>}
            </div>

            <h2 className="mt-10 text-xl font-bold tracking-tight">History</h2>
            <div className="mt-4 divide-y divide-[#183126]/10 rounded-2xl border border-[#183126]/10 bg-white px-5">{history.length > 0 ? history.map((booking) => <div key={booking.id} className="flex flex-wrap items-center gap-4 py-4"><Link href={`/account/bookings/${booking.id}`} className="flex min-w-0 flex-1 items-center gap-4 transition hover:opacity-75"><ServiceCategoryIcon category={booking.category} compact /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{booking.service}</p><p className="text-xs text-[#7a8881]">{booking.provider} · {bookingDate(booking.startsAt)}</p></div><span className={`text-xs font-bold capitalize ${booking.state === "cancelled" ? "text-[#9a5a47]" : "text-[#5c7766]"}`}>{booking.state}</span></Link>{booking.state === "completed" && <Link href={`/services/${booking.serviceSlug}?repeatOf=${booking.id}`} className="rounded-full bg-[#eee25a] px-3 py-2 text-xs font-bold">Book again</Link>}<span aria-hidden="true">→</span></div>) : <p className="py-5 text-sm text-[#7a8881]">Completed and cancelled bookings will appear here.</p>}</div>
          </div>

          <aside><div className="rounded-[2rem] bg-[#183126] p-6 text-white"><UiIcon name="shield" className="h-7 w-7" /><h2 className="mt-4 text-xl font-bold">Booking support in one place</h2><p className="mt-2 text-sm leading-6 text-[#b7c6be]">The BubsBookings Promise keeps booking records, payment status, messages, and support together. It is not insurance or a workmanship guarantee.</p><Link href="/promise" className="mt-5 inline-flex rounded-full px-3 py-2 text-sm font-bold text-[#eee25a] transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eee25a]">See coverage and limitations →</Link></div><div className="mt-4 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#74837b]">Need help?</p><p className="mt-3 text-sm leading-6 text-[#65766d]">Send a message directly to the BubsBookings admin team.</p><ContactSupportButton className="mt-4 rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] shadow-sm transition hover:bg-[#f5ea6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eee25a] focus-visible:ring-offset-2" /></div></aside>
        </div> : <div className="mt-8">
          <div className="flex items-end justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Saved services</h2><p className="mt-1 text-sm text-[#728179]">Your shortlist of favorite services.</p></div><Link href="/services" className="text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">Explore more</Link></div>
          {savedServices.length > 0 ? <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{savedServices.map((service) => {
            const visual = serviceVisuals[service.category] ?? { gradient: "from-[#e5eee4] to-[#f6efc8]" };
            return <article key={service.id} className="group relative overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_6px_24px_rgba(24,49,38,.05)] transition">
              <Link href={`/services/${service.slug}`} className="block">
                <div style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`relative grid h-52 place-items-center bg-cover bg-center ${service.imageUrls[0] ? "bg-[#e5e8e2]" : `bg-gradient-to-br ${visual.gradient}`}`}>{!service.imageUrls[0] && <ServiceCategoryIcon category={service.category} className="h-20 min-h-20 w-20 min-w-20" />}</div>
                <div className="p-5"><div className="flex justify-between gap-4 text-sm"><span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-[#64776d]"><UiIcon name={service.deliveryType === "IN_PERSON" ? "map-pin" : "globe"} className="h-4 w-4 shrink-0" /><span>{service.deliveryType === "REMOTE" ? "Available online" : service.deliveryType === "BOTH" ? "Online or in person" : `${service.city}, ${service.state}`}</span></span><span className="shrink-0 font-bold">{service.pricingType === "FIXED" ? "From " : ""}{formatServicePrice(service)}</span></div><h3 className="mt-3 text-lg font-bold">{service.title}</h3><p className="mt-1 text-sm text-[#718078]">{service.provider}</p></div>
              </Link>
              <FavoriteButton serviceId={service.id} serviceTitle={service.title} onChange={(saved) => { if (!saved) setSavedServices((current) => current.filter((item) => item.id !== service.id)); }} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-[#b54e46] shadow-sm" />
            </article>;
          })}</div> : <div className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white px-6 py-12 text-center"><p className="text-3xl">♡</p><h3 className="mt-3 font-bold">No saved services yet</h3><p className="mt-2 text-sm text-[#728179]">Services you save will appear here.</p><Link href="/services" className="mt-5 inline-flex rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white">Find services</Link></div>}
        </div>}
      </div>
    </main>
  );
}
