"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import ServiceImageManager from "@/components/service-image-manager";

type RequestStatus = "new" | "accepted" | "declined";

const initialRequests: Array<{ id: number; customer: string; initials: string; service: string; date: string; time: string; location: string; price: number; status: RequestStatus }> = [];

type ProviderSummary = {
  name: string;
  businessName: string;
  location: string;
  service: ProviderService | null;
  services: ProviderService[];
};

type ProviderService = { id: string; slug: string; title: string; category: string; price: number; durationMinutes: number; imageUrls: string[] };

function formatDuration(minutes: number) {
  if (minutes >= 480) return "Full day";
  if (minutes >= 240) return "Half day";
  return `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
}

export default function ProviderDashboard() {
  const { data: session } = authClient.useSession();
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState(true);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [providerLoaded, setProviderLoaded] = useState(false);
  const [photoUploadFailed, setPhotoUploadFailed] = useState(false);
  const [listingDeleted, setListingDeleted] = useState(false);

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

  function updateRequest(id: number, status: RequestStatus) {
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request));
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

  return (
    <main className="min-h-screen bg-[#f4f4ef] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe <span className="hidden rounded-full bg-[#e8f0e5] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#55705e] sm:inline">Provider</span></Link>
          <div className="flex items-center gap-2 sm:gap-3"><Link href="/account" className="rounded-full border border-[#183126]/15 bg-[#faf9f5] px-4 py-2.5 text-xs font-bold transition hover:border-[#4d725d] hover:bg-white sm:text-sm">↔ <span className="hidden sm:inline">Switch to </span>customer</Link><button className="relative hidden h-10 w-10 place-items-center rounded-full border border-[#183126]/10 bg-[#faf9f5] sm:grid" aria-label="Notifications">🔔</button><div aria-label={`${accountName} account`} className="grid h-10 w-10 place-items-center rounded-full bg-[#dfead9] text-sm font-bold">{initials}</div></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[210px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-8 space-y-1 text-sm font-semibold">
            <a href="#overview" className="flex items-center gap-3 rounded-xl bg-[#183126] px-4 py-3 text-white"><span>▦</span>Overview</a>
            <a href="#requests" className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white"><span>◷</span>Bookings <span className="ml-auto rounded-full bg-[#eee25a] px-2 py-0.5 text-[10px] text-[#183126]">2</span></a>
            <a href="#services" className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white"><span>◇</span>Services</a>
            <a href="#" className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white"><span>□</span>Availability</a>
            <a href="#" className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white"><span>☆</span>Reviews</a>
            <div className="my-4 border-t border-[#183126]/10" />
            <a href="#" className="flex items-center gap-3 rounded-xl px-4 py-3 transition hover:bg-white"><span>⚙</span>Settings</a>
          </nav>
        </aside>

        <div>
          {notice && provider && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#a8c1a9] bg-[#e8f2e7] p-4 text-sm"><div><p className="font-bold">Welcome to BookMe, {provider.businessName}!</p><p className="mt-1 text-[#567060]">Your provider profile and first service are saved.</p></div><button onClick={() => setNotice(false)} aria-label="Dismiss" className="text-lg text-[#64786a]">×</button></div>}
          {photoUploadFailed && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#e0b58f] bg-[#fff3e9] p-4 text-sm"><div><p className="font-bold">Your listing was saved, but a photo did not upload.</p><p className="mt-1 text-[#765e4c]">You can add it again under Your services below.</p></div><button onClick={() => setPhotoUploadFailed(false)} aria-label="Dismiss" className="text-lg text-[#806b5b]">×</button></div>}
          {listingDeleted && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#a8c1a9] bg-[#e8f2e7] p-4 text-sm"><div><p className="font-bold">Listing deleted.</p><p className="mt-1 text-[#567060]">It is no longer visible in customer searches.</p></div><button onClick={() => setListingDeleted(false)} aria-label="Dismiss" className="text-lg text-[#64786a]">×</button></div>}

          {providerLoaded && !provider && <div className="mb-6 rounded-2xl border border-[#d6ca65] bg-[#fff8cd] p-5 text-sm"><p className="font-bold">Create your provider profile to use this dashboard.</p><p className="mt-1 text-[#6f6840]">Add your business, first service, and availability to start getting discovered.</p><Link href="/providers/join" className="mt-4 inline-flex rounded-full bg-[#183126] px-4 py-2 font-bold text-white">Start provider setup</Link></div>}

          <div id="overview" className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold text-[#687a70]">Today&apos;s overview</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Welcome, {firstName}.</h1><p className="mt-2 text-sm text-[#687a70]">{provider ? `${provider.businessName} · ${provider.location}` : "Here's what’s happening with your business."}</p></div>
            <Link href="/providers/join" className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5">+ Add a service</Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "This month", value: "$0", note: "No completed jobs yet", icon: "$" }, { label: "Upcoming jobs", value: "0", note: "Your schedule is clear", icon: "◷" }, { label: "New requests", value: "0", note: "No requests yet", icon: "↗" }, { label: "Average rating", value: "—", note: "No reviews yet", icon: "★" }].map((stat) => <div key={stat.label} className="rounded-2xl border border-[#183126]/10 bg-white p-5 shadow-[0_4px_18px_rgba(24,49,38,.04)]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">{stat.label}</p><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf2e8] text-sm font-bold">{stat.icon}</span></div><p className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</p><p className="mt-1 text-xs text-[#77857e]">{stat.note}</p></div>)}
          </div>

          <section id="requests" className="mt-8 rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_6px_24px_rgba(24,49,38,.05)] sm:p-7">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold tracking-tight">Booking requests</h2><p className="mt-1 text-sm text-[#73827b]">Respond quickly to keep customers in the loop.</p></div><button className="text-sm font-bold underline decoration-[#c5b940] decoration-2 underline-offset-4">View all</button></div>
            <div className="mt-6 divide-y divide-[#183126]/10">
              {requests.length === 0 && <div className="rounded-2xl bg-[#f5f5ef] px-5 py-8 text-center"><p className="font-bold">No booking requests yet</p><p className="mt-1 text-sm text-[#73827b]">New customer requests will appear here.</p></div>}
              {requests.map((request) => <div key={request.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eee2] text-sm font-bold">{request.initials}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold">{request.customer}</p>{request.status === "new" && <span className="rounded-full bg-[#fff2c1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#806817]">New</span>}</div><p className="mt-1 truncate text-sm text-[#6f7e76]">{request.service} · {request.location}</p></div></div>
                <div className="flex items-center justify-between gap-6 xl:w-[46%]"><div><p className="text-sm font-bold">{request.date}</p><p className="mt-1 text-xs text-[#74827b]">{request.time} · ${request.price}</p></div>{request.status === "new" ? <div className="flex gap-2"><button onClick={() => updateRequest(request.id, "declined")} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold hover:bg-[#f5f4ef]">Decline</button><button onClick={() => updateRequest(request.id, "accepted")} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">Accept</button></div> : <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${request.status === "accepted" ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#f2ebe7] text-[#805747]"}`}>{request.status === "accepted" ? "Accepted ✓" : "Declined"}</span>}</div>
              </div>)}
            </div>
          </section>

          <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <section id="services" className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Your services</h2><p className="mt-1 text-xs text-[#738179]">Edit details, photos, pricing, or remove a listing.</p></div><Link href="/providers/join" className="text-sm font-bold">+ Add</Link></div>{provider?.services.length ? <div className="mt-5 space-y-5">{provider.services.map((service) => <div key={service.id} className="rounded-2xl bg-[#f5f5ef] p-4"><div className="flex items-center gap-4"><span role="img" aria-label={`${service.title} cover`} style={service.imageUrls[0] ? { backgroundImage: `url("${service.imageUrls[0]}")` } : undefined} className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-cover bg-center ${service.imageUrls[0] ? "" : "bg-gradient-to-br from-lime-700 to-yellow-200 text-3xl"}`}>{service.imageUrls[0] ? "" : "🧰"}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{service.title}</p><p className="mt-1 text-xs text-[#738179]">From ${service.price} · {formatDuration(service.durationMinutes)}</p></div><Link href={`/provider/services/${service.id}/edit`} className="rounded-full border border-[#183126]/15 bg-white px-4 py-2 text-xs font-bold hover:border-[#4d725d]">Edit</Link></div><ServiceImageManager serviceId={service.id} initialImageUrls={service.imageUrls} compact /></div>)}</div> : <p className="mt-5 rounded-2xl bg-[#f5f5ef] p-5 text-sm text-[#738179]">You do not have any active services. Add one to appear in customer searches.</p>}</section>
            <section className="rounded-[2rem] bg-[#183126] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a9c1b1]">Profile strength</p><div className="mt-3 flex items-end justify-between"><p className="text-3xl font-bold">{hasListingPhotos ? "100%" : "75%"}</p><p className="text-xs text-[#adbbb3]">{hasListingPhotos ? "Complete" : "Add listing photos"}</p></div><div className="mt-4 h-2 rounded-full bg-white/15"><div className={`h-full rounded-full bg-[#eee25a] ${hasListingPhotos ? "w-full" : "w-3/4"}`} /></div><a href="#services" className="mt-5 inline-block text-sm font-bold text-[#eee25a]">{hasListingPhotos ? "Your profile is ready ✓" : "Add photos →"}</a></section>
          </div>
        </div>
      </div>
    </main>
  );
}
