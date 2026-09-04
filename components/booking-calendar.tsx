"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type View = "day" | "week" | "month";
type Event = { id: string; title: string; person: string; startsAt: string; endsAt: string; location: string; status: string };

export default function BookingCalendar({ role }: { role: "customer" | "provider" }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`/api/calendar?role=${role}`, { cache: "no-store" }).then(async (response) => {
    const data = response.ok ? await response.json() as { events: Event[] } : { events: [] }; setEvents(data.events); setLoading(false);
  }).catch(() => setLoading(false)); }, [role]);

  const range = useMemo(() => {
    const start = new Date(anchor); start.setHours(0, 0, 0, 0);
    if (view === "week") start.setDate(start.getDate() - start.getDay());
    if (view === "month") start.setDate(1);
    const end = new Date(start); end.setDate(end.getDate() + (view === "day" ? 1 : view === "week" ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    return { start, end };
  }, [anchor, view]);
  const visible = events.filter((event) => { const date = new Date(event.startsAt); return date >= range.start && date < range.end; });
  const title = view === "day" ? anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : view === "week" ? `Week of ${range.start.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
    : anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  function move(direction: number) { const next = new Date(anchor); next.setDate(next.getDate() + direction * (view === "day" ? 1 : view === "week" ? 7 : 30)); setAnchor(next); }
  const href = (id: string) => role === "provider" ? `/provider/dashboard/bookings/${id}` : `/account/bookings/${id}`;

  return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Schedule</p><h1 className="mt-2 text-3xl font-bold">Booking calendar</h1></div>
      <div className="flex rounded-full bg-[#eef1eb] p-1">{(["day", "week", "month"] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${view === item ? "bg-[#183126] text-white" : "hover:bg-white"}`}>{item}</button>)}</div></div>
    <div className="mt-7 flex items-center justify-between gap-3"><button onClick={() => move(-1)} aria-label="Previous period" className="rounded-full border px-4 py-2 font-bold hover:bg-[#eee25a]">←</button><h2 className="text-center text-lg font-bold">{title}</h2><button onClick={() => move(1)} aria-label="Next period" className="rounded-full border px-4 py-2 font-bold hover:bg-[#eee25a]">→</button></div>
    <div className="mt-6 space-y-3">{loading ? <p className="rounded-2xl bg-[#f5f5ef] p-6 text-sm text-[#718078]">Loading your calendar…</p> : visible.length ? visible.map((event) => <Link key={event.id} href={href(event.id)} className="flex flex-col gap-3 rounded-2xl border border-[#183126]/10 p-4 transition hover:border-[#66816f] hover:bg-[#f7f8f3] sm:flex-row sm:items-center">
      <div className="w-24 shrink-0"><p className="text-xs font-bold uppercase text-[#6f7e76]">{new Date(event.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p><p className="mt-1 font-bold">{new Date(event.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p></div>
      <div className="min-w-0 flex-1"><p className="font-bold">{event.title}</p><p className="mt-1 truncate text-sm text-[#6f7e76]">{event.person} · {event.location}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${event.status === "confirmed" ? "bg-[#e3f1e5] text-[#2f6d46]" : "bg-[#fff1bf] text-[#786317]"}`}>{event.status}</span></Link>) : <div className="rounded-2xl bg-[#f5f5ef] p-10 text-center"><p className="text-3xl">📅</p><p className="mt-3 font-bold">No bookings in this {view}</p><p className="mt-1 text-sm text-[#718078]">Use the arrows to look at another time period.</p></div>}</div>
  </section>;
}
