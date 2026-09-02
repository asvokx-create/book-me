"use client";

import Link from "next/link";
import { useState } from "react";

type RequestStatus = "new" | "accepted" | "declined";

const initialRequests = [
  { id: 1, customer: "Maya R.", initials: "MR", service: "Weekly lawn care", date: "Tomorrow", time: "9:00 AM", location: "Issaquah Highlands", price: 55, status: "new" as RequestStatus },
  { id: 2, customer: "Daniel K.", initials: "DK", service: "Seasonal yard cleanup", date: "This Friday", time: "2:00 PM", location: "Olde Town", price: 140, status: "new" as RequestStatus },
  { id: 3, customer: "Priya S.", initials: "PS", service: "Weekly lawn care", date: "Next Monday", time: "11:30 AM", location: "Talus", price: 55, status: "accepted" as RequestStatus },
];

export default function ProviderDashboard() {
  const [requests, setRequests] = useState(initialRequests);
  const [notice, setNotice] = useState(true);

  function updateRequest(id: number, status: RequestStatus) {
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request));
  }

  return (
    <main className="min-h-screen bg-[#f4f4ef] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe <span className="hidden rounded-full bg-[#e8f0e5] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[#55705e] sm:inline">Provider</span></Link>
          <div className="flex items-center gap-3"><button className="relative grid h-10 w-10 place-items-center rounded-full border border-[#183126]/10 bg-[#faf9f5]" aria-label="Notifications">🔔<span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#d45f40]" /></button><div className="grid h-10 w-10 place-items-center rounded-full bg-[#dfead9] text-sm font-bold">EC</div></div>
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
          {notice && <div className="mb-6 flex items-start justify-between gap-5 rounded-2xl border border-[#a8c1a9] bg-[#e8f2e7] p-4 text-sm"><div><p className="font-bold">Welcome to BookMe, Evergreen Yard Co.!</p><p className="mt-1 text-[#567060]">Your provider profile is ready. Complete the final checklist to start appearing in customer searches.</p></div><button onClick={() => setNotice(false)} aria-label="Dismiss" className="text-lg text-[#64786a]">×</button></div>}

          <div id="overview" className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-sm font-semibold text-[#687a70]">Today&apos;s overview</p><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Good morning, Evan.</h1><p className="mt-2 text-sm text-[#687a70]">Here&apos;s what&apos;s happening with your business.</p></div>
            <button className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5">+ Add a service</button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[{ label: "This month", value: "$1,245", note: "+18% from April", icon: "$" }, { label: "Upcoming jobs", value: "7", note: "Next: tomorrow", icon: "◷" }, { label: "New requests", value: "2", note: "Needs your reply", icon: "↗" }, { label: "Average rating", value: "4.9", note: "38 total reviews", icon: "★" }].map((stat) => <div key={stat.label} className="rounded-2xl border border-[#183126]/10 bg-white p-5 shadow-[0_4px_18px_rgba(24,49,38,.04)]"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">{stat.label}</p><span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf2e8] text-sm font-bold">{stat.icon}</span></div><p className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</p><p className="mt-1 text-xs text-[#77857e]">{stat.note}</p></div>)}
          </div>

          <section id="requests" className="mt-8 rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_6px_24px_rgba(24,49,38,.05)] sm:p-7">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold tracking-tight">Booking requests</h2><p className="mt-1 text-sm text-[#73827b]">Respond quickly to keep customers in the loop.</p></div><button className="text-sm font-bold underline decoration-[#c5b940] decoration-2 underline-offset-4">View all</button></div>
            <div className="mt-6 divide-y divide-[#183126]/10">
              {requests.map((request) => <div key={request.id} className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 xl:flex-row xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eee2] text-sm font-bold">{request.initials}</span><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold">{request.customer}</p>{request.status === "new" && <span className="rounded-full bg-[#fff2c1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#806817]">New</span>}</div><p className="mt-1 truncate text-sm text-[#6f7e76]">{request.service} · {request.location}</p></div></div>
                <div className="flex items-center justify-between gap-6 xl:w-[46%]"><div><p className="text-sm font-bold">{request.date}</p><p className="mt-1 text-xs text-[#74827b]">{request.time} · ${request.price}</p></div>{request.status === "new" ? <div className="flex gap-2"><button onClick={() => updateRequest(request.id, "declined")} className="rounded-full border border-[#183126]/15 px-4 py-2 text-xs font-bold hover:bg-[#f5f4ef]">Decline</button><button onClick={() => updateRequest(request.id, "accepted")} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">Accept</button></div> : <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${request.status === "accepted" ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#f2ebe7] text-[#805747]"}`}>{request.status === "accepted" ? "Accepted ✓" : "Declined"}</span>}</div>
              </div>)}
            </div>
          </section>

          <div className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <section id="services" className="rounded-[2rem] border border-[#183126]/10 bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Your services</h2><button className="text-sm font-bold">Manage →</button></div><div className="mt-5 flex items-center gap-4 rounded-2xl bg-[#f5f5ef] p-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lime-700 to-yellow-200 text-3xl">🌱</span><div className="min-w-0 flex-1"><p className="font-bold">Weekly lawn care</p><p className="mt-1 text-xs text-[#738179]">From $55 · 1–2 hours</p></div><span className="rounded-full bg-[#e2f0e3] px-3 py-1 text-xs font-bold text-[#37704b]">Active</span></div></section>
            <section className="rounded-[2rem] bg-[#183126] p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#a9c1b1]">Profile strength</p><div className="mt-3 flex items-end justify-between"><p className="text-3xl font-bold">75%</p><p className="text-xs text-[#adbbb3]">3 of 4 complete</p></div><div className="mt-4 h-2 rounded-full bg-white/15"><div className="h-full w-3/4 rounded-full bg-[#eee25a]" /></div><button className="mt-5 text-sm font-bold text-[#eee25a]">Finish your profile →</button></section>
          </div>
        </div>
      </div>
    </main>
  );
}
