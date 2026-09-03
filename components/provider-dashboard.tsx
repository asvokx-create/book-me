"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import ServiceImageManager from "@/components/service-image-manager";
import AvailabilityEditor from "@/components/availability-editor";
import NotificationBell from "@/components/notification-bell";
import MessagingCenter from "@/components/messaging-center";

type RequestStatus = "new" | "accepted" | "declined" | "completed";
export type DashboardSection = "overview" | "bookings" | "messages" | "revenue" | "services" | "availability" | "reviews" | "settings";

type ProviderBooking = { id: string; customer: string; initials: string; service: string; startsAt: string; location: string; price: number; status: RequestStatus };
const initialRequests: ProviderBooking[] = [];

type ProviderSummary = {
  name: string;
  businessName: string;
  location: string;
  service: ProviderService | null;
  services: ProviderService[];
  availability: Array<{ weekday: number; startTime: string; endTime: string }>;
};

type ProviderService = { id: string; slug: string; title: string; category: string; price: number; durationMinutes: number; imageUrls: string[] };

type RevenueSummary = {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  completedJobs: number;
  monthlyRevenue: Array<{ month: string; label: string; revenue: number }>;
  recentEarnings: Array<{ id: string; service: string; customer: string; completedAt: string; amount: number }>;
};

type ProviderReview = {
  id: string; bookingId: string; customerName: string; serviceTitle: string;
  rating: number; body: string; createdAt: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function formatDuration(minutes: number) {
  if (minutes >= 480) return "Full day";
  if (minutes >= 240) return "Half day";
  return `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(time: string) {
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatBookingDate(startsAt: string) {
  return new Date(startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatBookingTime(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const dashboardNav: Array<{ section: DashboardSection; href: string; icon: string; label: string }> = [
  { section: "overview", href: "/provider/dashboard", icon: "▦", label: "Overview" },
  { section: "bookings", href: "/provider/dashboard/bookings", icon: "◷", label: "Bookings" },
  { section: "messages", href: "/provider/dashboard/messages", icon: "✉", label: "Messages" },
  { section: "revenue", href: "/provider/dashboard/revenue", icon: "$", label: "Revenue" },
  { section: "services", href: "/provider/dashboard/services", icon: "◇", label: "Services" },
  { section: "availability", href: "/provider/dashboard/availability", icon: "□", label: "Availability" },
  { section: "reviews", href: "/provider/dashboard/reviews", icon: "☆", label: "Reviews" },
  { section: "settings", href: "/provider/dashboard/settings", icon: "⚙", label: "Settings" },
];

export default function ProviderDashboard({ section = "overview", initialConversationId = "" }: { section?: DashboardSection; initialConversationId?: string }) {
  const { data: session } = authClient.useSession();
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState(true);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [providerLoaded, setProviderLoaded] = useState(false);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [listingDeleted, setListingDeleted] = useState(false);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [revenueLoaded, setRevenueLoaded] = useState(false);
  const [bookingActionId, setBookingActionId] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  useEffect(() => {
    const photoNoticeTimer = window.setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      setPhotoUploadFailed(searchParams.get("photos") === "failed");
      setListingDeleted(searchParams.get("listing") === "deleted");
    }, 0);
    let active = true;
    fetch("/api/providers/me")
      .then(async (response) => response.ok ? response.json() as Promise<ProviderSummary> : null)
      .then((data) => { if (active) setProvider(data); })
      .finally(() => { if (active) setProviderLoaded(true); });
    return () => { active = false; window.clearTimeout(photoNoticeTimer); };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/providers/bookings")
      .then(async (response) => response.ok ? response.json() as Promise<{ bookings: ProviderBooking[] }> : null)
      .catch(() => null)
      .then((data) => { if (active && data) setRequests(data.bookings); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== "revenue" && section !== "overview") return;
    let active = true;
    fetch("/api/providers/revenue")
      .then(async (response) => response.ok ? response.json() as Promise<RevenueSummary> : null)
      .catch(() => null)
      .then((data) => { if (active) setRevenue(data); })
      .finally(() => { if (active) setRevenueLoaded(true); });
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (section !== "reviews") return;
    let active = true;
    fetch("/api/providers/reviews", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ reviews: ProviderReview[] }> : null)
      .catch(() => null)
      .then((data) => { if (active && data) setReviews(data.reviews); })
      .finally(() => { if (active) setReviewsLoaded(true); });
    return () => { active = false; };
  }, [section]);

  async function updateRequest(id: string, action: "accepted" | "declined" | "completed") {
    setBookingActionId(id);
    setBookingError("");
    const response = await fetch(`/api/providers/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    if (!response) {
      setBookingError("We could not update this booking. Please try again.");
      setBookingActionId("");
      return;
    }
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setBookingError(data.error ?? "We could not update this booking.");
      setBookingActionId("");
      return;
    }
    const refreshed = await fetch("/api/providers/bookings");
    if (refreshed.ok) {
      const refreshedData = await refreshed.json() as { bookings: ProviderBooking[] };
      setRequests(refreshedData.bookings);
    }
    setBookingActionId("");
  }

  const accountName = provider?.name ?? session?.user.name ?? "Provider";
  const firstName = accountName.trim().split(/\s+/)[0] || "Provider";
  const initials = accountName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "P";
  const hasListingPhotos = provider?.services.some((service) => service.imageUrls.length > 0) ?? false;
  const activeRequests = requests.filter((request) => request.status === "new").length;
  const acceptedRequests = requests.filter((request) => request.status === "accepted").length;
  const nextAvailability = provider?.availability[0];
  const profileChecklist = [
    { label: "Business profile", complete: Boolean(provider) },
    { label: "Active service", complete: Boolean(provider?.services.length) },
    { label: "Listing photos", complete: hasListingPhotos },
    { label: "Working hours", complete: Boolean(provider?.availability.length) },
  ];
  const completedProfileItems = profileChecklist.filter((item) => item.complete).length;

  return (
    <main className="min-h-screen scroll-smooth bg-[#f4f4ef] text-[#183126]">
      <header className="relative z-50 border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe <span className="hidden rounded-full bg-[#e8f0e5] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#55705e] sm:inline">Provider</span></Link>
          <div className="flex items-center gap-2 sm:gap-3"><Link href="/account" className="rounded-full border border-[#183126]/15 bg-[#faf9f5] px-4 py-2.5 text-xs font-bold transition hover:border-[#4d725d] hover:bg-[#dfead9] sm:text-sm">↔ <span className="hidden sm:inline">Switch to </span>customer</Link><NotificationBell /><div aria-label={`${accountName} account`} className="grid h-10 w-10 place-items-center rounded-full bg-[#dfead9] text-sm font-bold">{initials}</div></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-8 space-y-1 text-sm font-semibold">
            {dashboardNav.map((item) => <div key={item.section}>{item.section === "settings" && <div className="my-4 border-t border-[#183126]/10" />}<Link href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${section === item.section ? "bg-[#183126] text-white" : "hover:bg-[#dfead9]"}`}><span>{item.icon}</span>{item.label}{item.section === "bookings" && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${section === "bookings" ? "bg-[#eee25a] text-[#183126]" : "bg-[#eee25a]"}`}>{activeRequests}</span>}</Link></div>)}
          </nav>
        </aside>

        <div>
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-2 text-sm font-bold lg:hidden">{dashboardNav.map((item) => <Link key={item.section} href={item.href} className={`shrink-0 rounded-full px-4 py-2.5 ${section === item.section ? "bg-[#183126] text-white" : "border border-[#183126]/10 bg-white"}`}>{item.label}</Link>)}</nav>
          {notice && provider && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#a8c1a9] bg-[#e8f2e7] p-4 text-sm"><div><p className="font-bold">Welcome to BookMe, {provider.businessName}!</p><p className="mt-1 text-[#567060]">Your provider profile and first service are saved.</p></div><button onClick={() => setNotice(false)} aria-label="Dismiss" className="rounded-full px-2 text-lg text-[#64786a] transition hover:bg-[#cbdcc8]">×</button></div>}
          {photoUploadFailed && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#e0b58f] bg-[#fff3e9] p-4 text-sm"><div><p className="font-bold">Your listing was saved, but a photo did not upload.</p><p className="mt-1 text-[#765e4c]">You can add it again under Your services below.</p></div><button onClick={() => setPhotoUploadFailed(false)} aria-label="Dismiss" className="rounded-full px-2 text-lg text-[#806b5b] transition hover:bg-[#f4d8cc]">×</button></div>}
          {listingDeleted && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#a8c1a9] bg-[#e8f2e7] p-4 text-sm"><div><p className="font-bold">Listing deleted.</p><p className="mt-1 text-[#567060]">It is no longer visible in customer searches.</p></div><button onClick={() => setListingDeleted(false)} aria-label="Dismiss" className="rounded-full px-2 text-lg text-[#64786a] transition hover:bg-[#cbdcc8]">×</button></div>}

          {providerLoaded && !provider && <div className="mb-6 rounded-2xl border border-[#d6ca65] bg-[#fff8cd] p-5 text-sm"><p className="font-bold">Create your provider profile to use this dashboard.</p><p className="mt-1 text-[#6f6840]">Add your business, first service, and availability to start getting discovered.</p><Link href="/providers/join" className="mt-4 inline-flex rounded-full bg-[#183126] px-4 py-2 font-bold text-white">Start provider setup</Link></div>}

          {section === "overview" && <><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold text-[#687a70]">Today&apos;s overview</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Welcome, {firstName}.</h1><p className="mt-2 text-sm text-[#687a70]">{provider ? `${provider.businessName} · ${provider.location}` : "Here's what’s happening with your business."}</p></div>
            <Link href="/providers/join" className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5">+ Add a service</Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "This month", value: revenue ? formatCurrency(revenue.thisMonthRevenue) : "$0", note: revenue?.thisMonthRevenue ? "From completed jobs" : "No completed jobs yet", icon: "$" }, { label: "Upcoming jobs", value: String(acceptedRequests), note: acceptedRequests ? "Accepted bookings" : "Your schedule is clear", icon: "◷" }, { label: "New requests", value: String(activeRequests), note: activeRequests ? "Waiting for a response" : "No requests yet", icon: "↗" }, { label: "Average rating", value: "—", note: "No reviews yet", icon: "★" }].map((stat) => <div key={stat.label} className="rounded-2xl border border-[#183126]/10 bg-white p-5 shadow-[0_4px_18px_rgba(24,49,38,.04)]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">{stat.label}</p><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf2e8] text-sm font-bold">{stat.icon}</span></div><p className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</p><p className="mt-1 text-xs text-[#77857e]">{stat.note}</p></div>)}
          </div>

          <section className="mt-8 rounded-[2rem] bg-[#183126] p-6 text-white sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#acc0b5]">Quick actions</p><h2 className="mt-2 text-2xl font-bold">What would you like to manage?</h2></div><div className="flex flex-wrap gap-2"><Link href="/providers/join" className="rounded-full bg-[#eee25a] px-4 py-2.5 text-xs font-bold text-[#183126]">+ Add service</Link><Link href="/provider/dashboard/services" className="rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold">Manage listings</Link><Link href="/provider/dashboard/availability" className="rounded-full border border-white/20 px-4 py-2.5 text-xs font-bold">Update hours</Link></div></div>
          </section>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Bookings</p><h2 className="mt-2 text-xl font-bold">Latest requests</h2></div><Link href="/provider/dashboard/bookings" className="text-sm font-bold underline decoration-[#c5b940] decoration-2 underline-offset-4">View bookings</Link></div>
              {requests.length ? <div className="mt-5 space-y-3">{requests.slice(0, 3).map((request) => <div key={request.id} className="flex items-center gap-3 rounded-2xl bg-[#f5f5ef] p-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#e5ede0] text-xs font-bold">{request.initials}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{request.customer}</p><p className="truncate text-xs text-[#738179]">{request.service} · {formatBookingDate(request.startsAt)}</p></div><span className="rounded-full bg-[#fff1bf] px-2.5 py-1 text-[10px] font-bold uppercase">{request.status}</span></div>)}</div> : <div className="mt-5 rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="text-2xl">📅</p><p className="mt-2 font-bold">No requests yet</p><p className="mt-1 text-sm text-[#738179]">New customer booking requests will appear here.</p></div>}
            </section>

            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Services</p><h2 className="mt-2 text-xl font-bold">Active listings</h2></div><Link href="/provider/dashboard/services" className="text-sm font-bold underline decoration-[#c5b940] decoration-2 underline-offset-4">Manage</Link></div>
              {provider?.services.length ? <div className="mt-5 space-y-3">{provider.services.slice(0, 3).map((service) => <div key={service.id} className="flex items-center gap-4 rounded-2xl bg-[#f5f5ef] p-4"><span role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cover bg-center ${service.imageUrls[0] ? "" : "bg-gradient-to-br from-lime-700 to-yellow-200 text-2xl"}`}>{service.imageUrls[0] ? "" : "🧰"}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{service.title}</p><p className="mt-1 text-xs text-[#738179]">From ${service.price} · {formatDuration(service.durationMinutes)}</p></div><Link href={`/provider/services/${service.id}/edit`} className="rounded-full border border-[#183126]/15 bg-white px-3 py-2 text-xs font-bold">Edit</Link></div>)}</div> : <div className="mt-5 rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="text-2xl">◇</p><p className="mt-2 font-bold">No active listings</p><Link href="/providers/join" className="mt-3 inline-flex text-sm font-bold underline">Create your first service</Link></div>}
            </section>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Schedule</p><h2 className="mt-2 text-xl font-bold">Working hours</h2></div><Link href="/provider/dashboard/availability" className="text-sm font-bold">Edit</Link></div>{nextAvailability ? <div className="mt-5 rounded-2xl bg-[#e8f0e5] p-5"><p className="text-sm font-bold">Next saved schedule</p><p className="mt-2 text-lg font-bold">{dayNames[nextAvailability.weekday]}</p><p className="mt-1 text-sm text-[#5f7367]">{formatTime(nextAvailability.startTime)}–{formatTime(nextAvailability.endTime)}</p><p className="mt-3 text-xs text-[#718078]">{provider?.availability.length} working {provider?.availability.length === 1 ? "day" : "days"} saved</p></div> : <div className="mt-5 rounded-2xl bg-[#fff6cf] p-5"><p className="font-bold">Add your working hours</p><p className="mt-1 text-sm text-[#776c3e]">Customers need your availability before they can choose a time.</p></div>}</section>

            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Profile setup</p><h2 className="mt-2 text-xl font-bold">Ready to get booked</h2></div><span className="rounded-full bg-[#edf2e8] px-3 py-1.5 text-xs font-bold">{completedProfileItems}/{profileChecklist.length}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{profileChecklist.map((item) => <div key={item.label} className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-bold ${item.complete ? "bg-[#e8f0e5]" : "bg-[#f5f5ef] text-[#718078]"}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${item.complete ? "bg-[#183126] text-white" : "border border-[#183126]/20"}`}>{item.complete ? "✓" : ""}</span>{item.label}</div>)}</div></section>
          </div></>}

          {section === "bookings" && <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_6px_24px_rgba(24,49,38,.05)] sm:p-7">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold tracking-tight">Booking requests</h2><p className="mt-1 text-sm text-[#73827b]">Respond quickly to keep customers in the loop.</p></div><span className="rounded-full bg-[#f0f1eb] px-3 py-1.5 text-xs font-bold">{requests.length} total</span></div>
            {bookingError && <p role="alert" className="mt-5 rounded-xl bg-[#fff1e8] px-4 py-3 text-sm font-semibold text-[#9a4e25]">{bookingError}</p>}
            <div className="mt-6 divide-y divide-[#183126]/10">
              {requests.length === 0 && <div className="rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="font-bold">No booking requests yet</p><p className="mt-1 text-sm text-[#73827b]">New customer requests will appear here.</p></div>}
              {requests.map((request) => <div key={request.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eee2] text-sm font-bold">{request.initials}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold">{request.customer}</p>{request.status === "new" && <span className="rounded-full bg-[#fff2c1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#806817]">New</span>}</div><p className="mt-1 truncate text-sm text-[#6f7e76]">{request.service} · {request.location}</p></div></div>
                <div className="flex flex-wrap items-center justify-between gap-4 xl:w-[58%]"><div><p className="text-sm font-bold">{formatBookingDate(request.startsAt)}</p><p className="mt-1 text-xs text-[#74827b]">{formatBookingTime(request.startsAt)} · ${request.price}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><Link href={`/provider/dashboard/bookings/${request.id}`} className="rounded-full border border-[#183126]/15 px-3 py-2 text-xs font-bold transition hover:bg-[#e5eddf]">View details</Link>{request.status === "new" ? <button disabled={bookingActionId === request.id} onClick={() => updateRequest(request.id, "accepted")} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{bookingActionId === request.id ? "Saving…" : "Accept"}</button> : request.status === "accepted" ? <><span className="rounded-full bg-[#e4f1e5] px-3 py-1.5 text-xs font-bold text-[#35704a]">Accepted ✓</span><button disabled={bookingActionId === request.id} onClick={() => updateRequest(request.id, "completed")} className="rounded-full border border-[#183126]/15 px-3 py-2 text-xs font-bold transition hover:bg-[#eee25a] disabled:opacity-50">Mark complete</button></> : <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${request.status === "completed" ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#f2ebe7] text-[#805747]"}`}>{request.status === "completed" ? "Completed ✓" : "Declined"}</span>}</div></div>
              </div>)}
            </div>
          </section>}

          {section === "messages" && <MessagingCenter mode="provider" initialConversationId={initialConversationId} />}

          {section === "revenue" && <RevenuePanel revenue={revenue} loaded={revenueLoaded} />}

          {section === "services" && <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Your services</h2><p className="mt-1 text-xs text-[#738179]">Edit details, photos, pricing, or remove a listing.</p></div><Link href="/providers/join" className="text-sm font-bold">+ Add</Link></div>{provider?.services.length ? <div className="mt-5 space-y-5">{provider.services.map((service) => <div key={service.id} className="rounded-2xl bg-[#f5f5ef] p-4"><div className="flex items-center gap-4"><span role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cover bg-center ${service.imageUrls[0] ? "" : "bg-gradient-to-br from-lime-700 to-yellow-200 text-3xl"}`}>{service.imageUrls[0] ? "" : "🧰"}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{service.title}</p><p className="mt-1 text-xs text-[#738179]">From ${service.price} · {formatDuration(service.durationMinutes)}</p></div><Link href={`/provider/services/${service.id}/edit`} className="rounded-full border border-[#183126]/15 bg-white px-4 py-2 text-xs font-bold hover:border-[#4d725d]">Edit</Link></div><ServiceImageManager serviceId={service.id} initialImageUrls={service.imageUrls} compact /></div>)}</div> : <p className="mt-5 rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">You do not have any active services. Add one to appear in customer searches.</p>}</section>
            <section className="rounded-[2rem] bg-[#183126] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a9c1b1]">Profile strength</p><div className="mt-3 flex items-end justify-between"><p className="text-3xl font-bold">{hasListingPhotos ? "100%" : "75%"}</p><p className="text-xs text-[#adbbb3]">{hasListingPhotos ? "Complete" : "Add listing photos"}</p></div><div className="mt-4 h-2 rounded-full bg-white/15"><div className={`h-full rounded-full bg-[#eee25a] ${hasListingPhotos ? "w-full" : "w-3/4"}`} /></div><p className="mt-5 text-sm font-bold text-[#eee25a]">{hasListingPhotos ? "Your profile is ready ✓" : "Add photos to a service"}</p></section>
          </div>}

          {section === "availability" && <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
              <div><h2 className="text-xl font-bold">Set your working hours</h2><p className="mt-1 text-sm text-[#738179]">Choose which days you work and set different start and end times for each day.</p></div>
              {provider ? <AvailabilityEditor key={provider.availability.map((slot) => `${slot.weekday}-${slot.startTime}-${slot.endTime}`).join("|")} initialSlots={provider.availability} onSaved={(slots) => setProvider((current) => current ? { ...current, availability: slots } : current)} /> : <div className="mt-6 rounded-2xl bg-[#f5f5ef] p-6 text-sm text-[#738179]">{providerLoaded ? "Create your provider profile before setting working hours." : "Loading your current hours…"}</div>}
          </section>}
          {section === "reviews" && <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">Verified reviews</h2><p className="mt-1 text-sm text-[#738179]">Feedback can only come from completed BookMe bookings.</p></div>{reviews.length > 0 && <div className="rounded-full bg-[#edf2e8] px-4 py-2 text-sm font-bold"><span className="text-[#d0a51d]">★</span> {(reviews.reduce((total, item) => total + item.rating, 0) / reviews.length).toFixed(1)} · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</div>}</div>
              {!reviewsLoaded ? <p className="mt-6 rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">Loading reviews…</p> : reviews.length ? <div className="mt-6 grid gap-4 lg:grid-cols-2">{reviews.map((item) => <article key={item.id} className="rounded-2xl border border-[#183126]/10 bg-[#fafaf6] p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{item.customerName}</p><p className="mt-1 text-xs text-[#74827b]">{item.serviceTitle} · {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div><span className="shrink-0 text-[#d0a51d]">{"★".repeat(item.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - item.rating)}</span></span></div><p className="mt-4 text-sm leading-6 text-[#52665b]">{item.body}</p><Link href={`/provider/dashboard/bookings/${item.bookingId}`} className="mt-4 inline-flex text-xs font-bold underline decoration-[#c5b940] decoration-2 underline-offset-4">View booking</Link></article>)}</div> : <div className="mt-5 rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="text-2xl">☆</p><p className="mt-2 font-bold">No reviews yet</p><p className="mt-1 text-sm text-[#738179]">Your first review will appear here after a completed booking.</p></div>}
          </section>}

          {section === "settings" && <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Business settings</h2><p className="mt-1 text-sm text-[#738179]">{provider ? `${provider.businessName} · ${provider.location}` : "Complete your provider profile to manage business settings."}</p></div><div className="flex flex-wrap gap-2"><Link href="/providers/join" className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold">Edit profile</Link>{provider?.service && <Link href={`/provider/services/${provider.service.id}/edit`} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">Manage listing</Link>}</div></div>
          </section>}
        </div>
      </div>
    </main>
  );
}

function RevenuePanel({ revenue, loaded }: { revenue: RevenueSummary | null; loaded: boolean }) {
  if (!loaded) return <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-8 text-sm text-[#738179]">Loading your revenue…</div>;
  if (!revenue) return <div className="rounded-[2rem] border border-[#d6ca65] bg-[#fff8cd] p-6"><h1 className="text-xl font-bold">Revenue is not available yet</h1><p className="mt-2 text-sm text-[#6f6840]">Complete your provider profile to start tracking completed jobs and revenue.</p></div>;

  const maxRevenue = Math.max(...revenue.monthlyRevenue.map((month) => month.revenue), 1);
  const chartPoints = revenue.monthlyRevenue.map((month, index) => {
    const x = 30 + (index * 660) / Math.max(revenue.monthlyRevenue.length - 1, 1);
    const y = 205 - (month.revenue / maxRevenue) * 160;
    return { ...month, x, y };
  });
  const change = revenue.lastMonthRevenue > 0
    ? ((revenue.thisMonthRevenue - revenue.lastMonthRevenue) / revenue.lastMonthRevenue) * 100
    : null;

  return <div>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-[#687a70]">Business performance</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Revenue</h1><p className="mt-2 text-sm text-[#687a70]">Revenue is counted when a BookMe job is marked completed.</p></div><span className="w-fit rounded-full bg-[#e7eee2] px-4 py-2 text-xs font-bold">{revenue.completedJobs} completed {revenue.completedJobs === 1 ? "job" : "jobs"}</span></div>

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      <RevenueCard label="Total revenue" value={formatCurrency(revenue.totalRevenue)} note="All completed jobs" featured />
      <RevenueCard label="This month" value={formatCurrency(revenue.thisMonthRevenue)} note={change === null ? "No prior-month comparison yet" : `${change >= 0 ? "+" : ""}${change.toFixed(0)}% from last month`} />
      <RevenueCard label="Last month" value={formatCurrency(revenue.lastMonthRevenue)} note="Completed jobs last month" />
    </div>

    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_5px_22px_rgba(24,49,38,.04)] sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Last six months</p><h2 className="mt-2 text-xl font-bold">Revenue trend</h2></div><p className="text-sm font-bold">{formatCurrency(revenue.monthlyRevenue.reduce((sum, month) => sum + month.revenue, 0))}</p></div>
      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[620px]">
          <svg viewBox="0 0 720 235" role="img" aria-label="Revenue by month for the last six months" className="h-auto w-full">
            {[45, 85, 125, 165, 205].map((y) => <line key={y} x1="30" x2="690" y1={y} y2={y} stroke="#183126" strokeOpacity="0.08" />)}
            {chartPoints.length > 1 && <polyline points={chartPoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#183126" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
            {chartPoints.map((point) => <g key={point.month}><line x1={point.x} x2={point.x} y1={point.y} y2="205" stroke="#d9e5d4" strokeWidth="12" strokeLinecap="round" /><circle cx={point.x} cy={point.y} r="7" fill="#eee25a" stroke="#183126" strokeWidth="3" /><text x={point.x} y="230" textAnchor="middle" className="fill-[#718078] text-[12px] font-bold">{point.label}</text>{point.revenue > 0 && <text x={point.x} y={Math.max(point.y - 14, 18)} textAnchor="middle" className="fill-[#183126] text-[11px] font-bold">{formatCurrency(point.revenue)}</text>}</g>)}
          </svg>
        </div>
      </div>
      {revenue.completedJobs === 0 && <div className="mt-3 rounded-2xl bg-[#f5f5ef] p-4 text-center text-sm text-[#738179]">Your graph will grow as you complete BookMe jobs.</div>}
    </section>

    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Activity</p><h2 className="mt-2 text-xl font-bold">Recent earnings</h2></div>{revenue.recentEarnings.length ? <div className="mt-5 divide-y divide-[#183126]/10">{revenue.recentEarnings.map((earning) => <div key={earning.id} className="flex items-center gap-4 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7eee2] font-bold text-[#476452]">$</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{earning.service}</p><p className="mt-1 text-xs text-[#74827b]">{earning.customer} · {new Date(earning.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p></div><p className="font-bold text-[#35704a]">+{formatCurrency(earning.amount)}</p></div>)}</div> : <div className="mt-5 rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="text-2xl">↗</p><p className="mt-2 font-bold">No earnings yet</p><p className="mt-1 text-sm text-[#738179]">Completed jobs will appear here automatically.</p></div>}</section>
  </div>;
}

function RevenueCard({ label, value, note, featured = false }: { label: string; value: string; note: string; featured?: boolean }) {
  return <div className={`rounded-[1.75rem] p-6 ${featured ? "bg-[#183126] text-white" : "border border-[#183126]/10 bg-white"}`}><div className="flex items-center justify-between"><p className={`text-xs font-bold uppercase tracking-[.12em] ${featured ? "text-[#b6c8bf]" : "text-[#718078]"}`}>{label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-bold ${featured ? "bg-[#eee25a] text-[#183126]" : "bg-[#edf2e8]"}`}>$</span></div><p className="mt-5 text-3xl font-bold tracking-tight">{value}</p><p className={`mt-2 text-xs ${featured ? "text-[#b6c8bf]" : "text-[#77857e]"}`}>{note}</p></div>;
}
