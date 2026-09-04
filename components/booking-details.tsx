"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import ReportUserButton from "@/components/report-user-button";

type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled";
type Booking = {
  id: string;
  viewerRole: "customer" | "provider";
  customerName: string;
  providerId: string;
  providerName: string;
  serviceId: string;
  serviceSlug: string;
  serviceTitle: string;
  category: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
  price: number;
  status: BookingStatus;
  cancelledBy: string | null;
  cancellationReason: string | null;
  completedAt: string | null;
  conversationId: string | null;
  review: { id: string; rating: number; body: string } | null;
};

const statusStyles: Record<BookingStatus, string> = {
  requested: "bg-[#fff1bf] text-[#786317]",
  confirmed: "bg-[#e3f1e5] text-[#2f6d46]",
  completed: "bg-[#e6ece8] text-[#405f4d]",
  cancelled: "bg-[#f5e5df] text-[#8a4f3d]",
};

const statusLabels: Record<BookingStatus, string> = {
  requested: "Awaiting provider",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function BookingDetails({ bookingId, expectedRole }: { bookingId: string; expectedRole: "customer" | "provider" }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const loadBooking = useCallback(async () => {
    const response = await fetch(`/api/bookings/${bookingId}`, { cache: "no-store" }).catch(() => null);
    const result = response ? await response.json() as { booking?: Booking; error?: string } : null;
    if (!response?.ok || !result?.booking || result.booking.viewerRole !== expectedRole) {
      setError(result?.error ?? "We could not load this booking.");
      setLoading(false);
      return;
    }
    setBooking(result.booking);
    setLoading(false);
  }, [bookingId, expectedRole]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBooking(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBooking]);

  async function providerAction(action: "accepted" | "declined" | "completed" | "cancel", reason = "") {
    setWorking(true);
    setError("");
    const response = await fetch(`/api/providers/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not update this booking.");
    else {
      setCancelOpen(false);
      setCancelReason("");
      await loadBooking();
    }
    setWorking(false);
  }

  async function cancelBooking(event: FormEvent) {
    event.preventDefault();
    if (!booking) return;
    if (booking.viewerRole === "provider") {
      await providerAction(booking.status === "requested" ? "declined" : "cancel", cancelReason);
      return;
    }
    setWorking(true);
    setError("");
    const response = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: cancelReason }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not cancel this booking.");
    else {
      setCancelOpen(false);
      setCancelReason("");
      await loadBooking();
    }
    setWorking(false);
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    const response = await fetch(`/api/bookings/${bookingId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, review }),
    }).catch(() => null);
    const result = response ? await response.json() as { review?: Booking["review"]; error?: string } : null;
    if (!response?.ok || !result?.review) setError(result?.error ?? "We could not save your review.");
    else {
      const savedReview = result.review;
      setBooking((current) => current ? { ...current, review: savedReview } : current);
    }
    setWorking(false);
  }

  if (loading) return <div className="rounded-[2rem] bg-white p-10 text-center text-sm text-[#6f7e76]">Loading booking details…</div>;
  if (!booking) return <div className="rounded-[2rem] border border-[#d6ca65] bg-[#fff8cd] p-8"><h1 className="text-xl font-bold">Booking unavailable</h1><p className="mt-2 text-sm text-[#6f6840]">{error}</p></div>;

  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const contactHref = booking.viewerRole === "customer"
    ? `/account/messages?${booking.conversationId ? `conversationId=${booking.conversationId}` : `providerId=${booking.providerId}&serviceId=${booking.serviceId}`}`
    : `/provider/dashboard/messages${booking.conversationId ? `?conversationId=${booking.conversationId}` : ""}`;
  const canCancel = booking.status === "requested" || booking.status === "confirmed";
  const canComplete = booking.viewerRole === "provider" && booking.status === "confirmed";

  return <>
    {error && <p role="alert" className="mb-5 rounded-2xl bg-[#fff0e8] px-5 py-4 text-sm font-semibold text-[#964f2c]">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_8px_30px_rgba(24,49,38,.05)]">
        <div className="bg-[#183126] p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyles[booking.status]}`}>{statusLabels[booking.status]}</span><span className="text-sm text-white/65">Booking #{booking.id.slice(0, 8).toUpperCase()}</span></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[.15em] text-[#b9c9c0]">{booking.category}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{booking.serviceTitle}</h1>
          <p className="mt-3 text-[#c3d0c9]">{booking.viewerRole === "customer" ? `With ${booking.providerName}` : `Booked by ${booking.customerName}`}</p>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          <Detail icon="◷" label="Date and time" value={start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} note={`${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`} />
          <Detail icon="$" label="Service price" value={`$${booking.price.toLocaleString()}`} note="Payment will be added later" />
          <Detail icon="⌖" label="Service location" value={booking.location} note="Shared only with this booking" />
          <Detail icon="✉" label={booking.viewerRole === "customer" ? "Provider" : "Customer"} value={booking.viewerRole === "customer" ? booking.providerName : booking.customerName} note="Message through BookMe" />
        </div>

        {booking.notes && <div className="border-t border-[#183126]/10 px-6 py-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Booking notes</p><p className="mt-2 text-sm leading-6 text-[#4f6559]">{booking.notes}</p></div>}
        {booking.status === "cancelled" && <div className="border-t border-[#183126]/10 bg-[#fff7f3] px-6 py-5 sm:px-8"><p className="font-bold text-[#854c3b]">Cancelled by {booking.cancelledBy ?? "a booking participant"}</p><p className="mt-2 text-sm leading-6 text-[#765e55]">{booking.cancellationReason || "No reason was provided."}</p></div>}
      </section>

      <aside className="space-y-5">
        <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
          <h2 className="text-lg font-bold">Manage this booking</h2>
          <div className="mt-5 grid gap-3">
            <Link href={contactHref} className="rounded-full bg-[#eee25a] px-5 py-3 text-center text-sm font-bold transition hover:bg-[#e1d43d]">✉ Contact {booking.viewerRole === "customer" ? "provider" : "customer"}</Link>
            {booking.viewerRole === "provider" && booking.status === "requested" && <button disabled={working} onClick={() => providerAction("accepted")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">Accept booking</button>}
            {canComplete && <button disabled={working} onClick={() => providerAction("completed")} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf] disabled:opacity-50">Mark job complete</button>}
            {canCancel && <button onClick={() => { setError(""); setCancelOpen(true); }} className="rounded-full px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline request" : "Cancel booking"}</button>}
            <ReportUserButton bookingId={booking.id} targetLabel={booking.viewerRole === "customer" ? "provider" : "customer"} />
            {booking.status !== "requested" && <Link href={`/disputes?bookingId=${booking.id}`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-center text-sm font-bold transition hover:bg-[#fff3b0]">Open a dispute</Link>}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#7b8982]">Both sides are notified whenever the booking status changes.</p>
        </div>
        <div className="rounded-[2rem] bg-[#e7eee2] p-6"><p className="text-2xl">☂</p><h2 className="mt-3 font-bold">BookMe Promise</h2><p className="mt-2 text-sm leading-6 text-[#61736a]">Your booking information and messages stay together in one secure place.</p></div>
      </aside>
    </div>

    {booking.viewerRole === "customer" && booking.status === "completed" && <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Verified booking</p>
      <h2 className="mt-2 text-2xl font-bold">{booking.review ? "Your review" : "How was your service?"}</h2>
      {booking.review ? <div className="mt-5 rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xl text-[#d0a51d]">{"★".repeat(booking.review.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - booking.review.rating)}</span></p><p className="mt-3 text-sm leading-6 text-[#52665b]">{booking.review.body}</p></div> : <form onSubmit={submitReview} className="mt-5 max-w-2xl"><div className="flex gap-1" aria-label="Rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className={`rounded-lg px-1 text-3xl transition hover:bg-[#fff4b5] ${star <= rating ? "text-[#d0a51d]" : "text-[#d8ddd9]"}`}>★</button>)}</div><label htmlFor="review" className="mt-5 block text-sm font-bold">Share your experience</label><textarea id="review" value={review} onChange={(event) => setReview(event.target.value)} minLength={3} maxLength={1000} rows={4} required className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="What went well? What should future customers know?" /><button disabled={working} className="mt-4 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working ? "Saving…" : "Post verified review"}</button></form>}
    </section>}

    {cancelOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><form onSubmit={cancelBooking} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 id="cancel-title" className="text-2xl font-bold">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline this request?" : "Cancel this booking?"}</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Give a short reason. It will be shared with the other person so they know what happened.</p><label htmlFor="cancellation-reason" className="mt-5 block text-sm font-bold">Reason</label><textarea id="cancellation-reason" autoFocus required minLength={3} maxLength={500} rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="For example: My schedule changed unexpectedly." /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCancelOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec]">Keep booking</button><button disabled={working} className="rounded-full bg-[#9b4e3a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#7f3d2d] disabled:opacity-50">{working ? "Saving…" : "Confirm"}</button></div></form></div>}
  </>;
}

function Detail({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf2e9] font-bold">{icon}</span><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#718078]">{label}</p><p className="mt-1 font-bold">{value}</p><p className="mt-1 text-xs text-[#7d8983]">{note}</p></div></div>;
}
