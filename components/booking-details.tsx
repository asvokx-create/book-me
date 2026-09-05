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
  lateCancellation: boolean;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  completedAt: string | null;
  conversationId: string | null;
  assignedTeamMemberId: string | null;
  assigneeName: string;
  teamMembers: Array<{ id: string; name: string }>;
  reschedule: { requestedBy: string | null; startsAt: string; endsAt: string; reason: string | null; requestedAt: string | null } | null;
  history: Array<{ id: string; type: string; message: string; createdAt: string }>;
  review: { id: string; rating: number; body: string } | null;
  quote: { status: "none" | "pending" | "accepted" | "declined"; price: number | null; message: string; sentAt: string | null; respondedAt: string | null };
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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quotePrice, setQuotePrice] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

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
    const timer = window.setTimeout(() => {
      void loadBooking();
      if (new URLSearchParams(window.location.search).get("reschedule") === "1") setRescheduleOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBooking]);

  async function providerAction(action: "accepted" | "declined" | "completed" | "cancel" | "approve_reschedule" | "decline_reschedule", reason = "") {
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

  async function requestReschedule(event: FormEvent) {
    event.preventDefault();
    setWorking(true); setError("");
    const response = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_reschedule", startsAt: new Date(rescheduleDate).toISOString(), reason: rescheduleReason }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not send your reschedule request.");
    else { setRescheduleOpen(false); setRescheduleDate(""); setRescheduleReason(""); await loadBooking(); }
    setWorking(false);
  }

  async function assignBooking(memberId: string) {
    setWorking(true); setError("");
    const response = await fetch(`/api/providers/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", memberId }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not assign this booking."); else await loadBooking();
    setWorking(false);
  }

  async function sendQuote(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    const response = await fetch(`/api/providers/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_quote", price: Number(quotePrice), reason: quoteMessage }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not send this quote."); else { setQuoteOpen(false); setQuotePrice(""); setQuoteMessage(""); await loadBooking(); }
    setWorking(false);
  }

  async function respondToQuote(action: "accept_quote" | "decline_quote") {
    setWorking(true); setError("");
    const response = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not update this quote."); else await loadBooking();
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
      <div className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_8px_30px_rgba(24,49,38,.05)]">
        <div className="bg-[#183126] p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusStyles[booking.status]}`}>{statusLabels[booking.status]}</span><span className="text-sm text-white/65">Booking #{booking.id.slice(0, 8).toUpperCase()}</span></div>
          <p className="mt-7 text-sm font-bold uppercase tracking-[.15em] text-[#b9c9c0]">{booking.category}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">{booking.serviceTitle}</h1>
          <p className="mt-3 text-[#c3d0c9]">{booking.viewerRole === "customer" ? `With ${booking.providerName}` : `Booked by ${booking.customerName}`}</p>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          <Detail icon="◷" label="Date and time" value={start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} note={`${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}–${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`} />
          <Detail icon="$" label={booking.quote.status === "accepted" ? "Approved quote" : "Service price"} value={`$${booking.price.toLocaleString()}`} note={booking.quote.status === "accepted" ? "Customer approved this price" : "Payment will be added later"} />
          <Detail icon="⌖" label="Service location" value={booking.location} note="Shared only with this booking" />
          <Detail icon="✉" label={booking.viewerRole === "customer" ? "Service professional" : "Customer"} value={booking.viewerRole === "customer" ? booking.assigneeName : booking.customerName} note={booking.viewerRole === "customer" ? `From ${booking.providerName}` : "Message through BubsBookings"} />
        </div>

        {booking.notes && <div className="border-t border-[#183126]/10 px-6 py-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Booking notes</p><p className="mt-2 text-sm leading-6 text-[#4f6559]">{booking.notes}</p></div>}
        {booking.status === "cancelled" && <div className="border-t border-[#183126]/10 bg-[#fff7f3] px-6 py-5 sm:px-8"><p className="font-bold text-[#854c3b]">Cancelled by {booking.cancelledBy ?? "a booking participant"}{booking.lateCancellation ? " · Late cancellation" : ""}</p><p className="mt-2 text-sm leading-6 text-[#765e55]">{booking.cancellationReason || "No reason was provided."}</p>{booking.lateCancellation && <p className="mt-2 text-xs font-semibold text-[#854c3b]">This was cancelled inside the provider&apos;s {booking.cancellationWindowHours}-hour notice window. Any future refund decision will follow the provider policy and payment terms.</p>}</div>}
      </section>

      {booking.quote.status !== "none" && booking.quote.price !== null && <section className={`rounded-[2rem] border p-6 sm:p-8 ${booking.quote.status === "pending" ? "border-[#d1c653] bg-[#fff9d8]" : booking.quote.status === "accepted" ? "border-[#7eaa86] bg-[#e8f3e8]" : "border-[#d8b2a2] bg-[#fff3ee]"}`}><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Custom service quote</p><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">${booking.quote.price.toLocaleString()} quote</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7168]">{booking.quote.message}</p></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold capitalize">{booking.quote.status}</span></div>{booking.viewerRole === "customer" && booking.quote.status === "pending" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={working} onClick={() => void respondToQuote("accept_quote")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:opacity-50">Approve ${booking.quote.price.toLocaleString()}</button><button disabled={working} onClick={() => void respondToQuote("decline_quote")} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold hover:bg-[#f4d8cc] disabled:opacity-50">Decline quote</button></div>}{booking.viewerRole === "provider" && booking.quote.status === "declined" && <p className="mt-4 text-sm font-bold text-[#8a4f3d]">The customer declined this quote. You can send a revised one.</p>}</section>}
      </div>

      <aside className="space-y-5">
        <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
          <h2 className="text-lg font-bold">Manage this booking</h2>
          <div className="mt-5 grid gap-3">
            <Link href={contactHref} className="rounded-full bg-[#eee25a] px-5 py-3 text-center text-sm font-bold transition hover:bg-[#e1d43d]">✉ Contact {booking.viewerRole === "customer" ? "provider" : "customer"}</Link>
            {booking.viewerRole === "provider" && canCancel && <label className="text-sm font-bold">Assigned professional<select disabled={working} value={booking.assignedTeamMemberId ?? "owner"} onChange={(event) => void assignBooking(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3"><option value="owner">Company owner</option>{booking.teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
            {booking.viewerRole === "provider" && booking.status === "requested" && <button disabled={working} onClick={() => { setQuotePrice(String(booking.quote.price ?? booking.price)); setQuoteMessage(booking.quote.message); setQuoteOpen(true); }} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#eee25a] disabled:opacity-50">{booking.quote.status === "none" ? "Send a custom quote" : "Send revised quote"}</button>}
            {booking.viewerRole === "customer" && canCancel && !booking.reschedule && <button onClick={() => setRescheduleOpen(true)} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#eee25a]">Request a new time</button>}
            {booking.status === "confirmed" && <a href={`/api/bookings/${booking.id}/calendar`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-center text-sm font-bold transition hover:bg-[#e5eddf]">Add to Google / Apple Calendar</a>}
            {booking.viewerRole === "provider" && booking.status === "requested" && <button disabled={working || booking.quote.status === "pending" || booking.quote.status === "declined"} onClick={() => providerAction("accepted")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-50">{booking.quote.status === "pending" ? "Waiting for quote approval" : booking.quote.status === "declined" ? "Send a revised quote" : "Accept booking"}</button>}
            {canComplete && <button disabled={working} onClick={() => providerAction("completed")} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf] disabled:opacity-50">Mark job complete</button>}
            {canCancel && <button onClick={() => { setError(""); setCancelOpen(true); }} className="rounded-full px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline request" : "Cancel booking"}</button>}
            <ReportUserButton bookingId={booking.id} targetLabel={booking.viewerRole === "customer" ? "provider" : "customer"} />
            {booking.status !== "requested" && <Link href={`/disputes?bookingId=${booking.id}`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-center text-sm font-bold transition hover:bg-[#fff3b0]">Open a dispute</Link>}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#7b8982]">Both sides are notified whenever the booking status changes.</p>
        </div>
        <div className="rounded-[2rem] bg-[#e7eee2] p-6"><p className="text-2xl">☂</p><h2 className="mt-3 font-bold">BubsBookings Promise</h2><p className="mt-2 text-sm leading-6 text-[#61736a]">Your booking information and messages stay together in one secure place.</p></div>
      </aside>
    </div>

    {booking.reschedule && <section className="mt-6 rounded-[2rem] border border-[#d1c653] bg-[#fff9d8] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#756d3f]">Pending reschedule</p><h2 className="mt-2 text-2xl font-bold">New time requested</h2><p className="mt-3 font-bold">{new Date(booking.reschedule.startsAt).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p><p className="mt-2 text-sm text-[#6f6840]">{booking.reschedule.reason}</p>{booking.viewerRole === "provider" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={working} onClick={() => providerAction("approve_reschedule")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846]">Approve new time</button><button disabled={working} onClick={() => { const reason = window.prompt("Why are you declining this new time?"); if (reason) void providerAction("decline_reschedule", reason); }} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold hover:bg-[#f4d8cc]">Decline</button></div>}</section>}

    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Activity</p><h2 className="mt-2 text-2xl font-bold">Booking history</h2><div className="mt-5 space-y-4">{booking.history.length ? booking.history.map((event) => <div key={event.id} className="flex gap-4"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#eee25a] ring-4 ring-[#f8f3bd]" /><div><p className="text-sm font-semibold">{event.message}</p><p className="mt-1 text-xs text-[#7a8881]">{new Date(event.createdAt).toLocaleString()}</p></div></div>) : <p className="text-sm text-[#718078]">Future booking changes will be recorded here.</p>}</div></section>

    {booking.viewerRole === "customer" && booking.status === "completed" && <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Verified booking</p>
      <h2 className="mt-2 text-2xl font-bold">{booking.review ? "Your review" : "How was your service?"}</h2>
      {booking.review ? <div className="mt-5 rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xl text-[#d0a51d]">{"★".repeat(booking.review.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - booking.review.rating)}</span></p><p className="mt-3 text-sm leading-6 text-[#52665b]">{booking.review.body}</p></div> : <form onSubmit={submitReview} className="mt-5 max-w-2xl"><div className="flex gap-1" aria-label="Rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className={`rounded-lg px-1 text-3xl transition hover:bg-[#fff4b5] ${star <= rating ? "text-[#d0a51d]" : "text-[#d8ddd9]"}`}>★</button>)}</div><label htmlFor="review" className="mt-5 block text-sm font-bold">Share your experience</label><textarea id="review" value={review} onChange={(event) => setReview(event.target.value)} minLength={3} maxLength={1000} rows={4} required className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="What went well? What should future customers know?" /><button disabled={working} className="mt-4 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working ? "Saving…" : "Post verified review"}</button></form>}
    </section>}

    {cancelOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><form onSubmit={cancelBooking} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 id="cancel-title" className="text-2xl font-bold">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline this request?" : "Cancel this booking?"}</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Give a short reason. It will be shared with the other person so they know what happened.</p>{booking.viewerRole === "customer" && booking.status === "confirmed" && <div className="mt-4 rounded-2xl bg-[#fff5cf] p-4 text-xs leading-5 text-[#6f642d]"><p className="font-bold">Provider notice window: {booking.cancellationWindowHours} hours</p><p className="mt-1">{booking.cancellationPolicy}</p><p className="mt-2">Cancellations inside this window are recorded as late. No fee is charged until payments and refund rules are added.</p></div>}<label htmlFor="cancellation-reason" className="mt-5 block text-sm font-bold">Reason</label><textarea id="cancellation-reason" autoFocus required minLength={3} maxLength={500} rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="For example: My schedule changed unexpectedly." /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCancelOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec]">Keep booking</button><button disabled={working} className="rounded-full bg-[#9b4e3a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#7f3d2d] disabled:opacity-50">{working ? "Saving…" : "Confirm cancellation"}</button></div></form></div>}
    {rescheduleOpen && booking.viewerRole === "customer" && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true"><form onSubmit={requestReschedule} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 className="text-2xl font-bold">Request a new time</h2><p className="mt-2 text-sm text-[#687970]">The provider must approve your request before the booking moves.</p><label htmlFor="reschedule-date" className="mt-5 block text-sm font-bold">New date and time</label><input id="reschedule-date" type="datetime-local" required value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /><label htmlFor="reschedule-reason" className="mt-4 block text-sm font-bold">Reason</label><textarea id="reschedule-reason" required minLength={3} maxLength={500} rows={3} value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="Why do you need a different time?" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRescheduleOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Close</button><button disabled={working} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846]">{working ? "Sending…" : "Send request"}</button></div></form></div>}
    {quoteOpen && booking.viewerRole === "provider" && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true"><form onSubmit={sendQuote} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Before confirmation</p><h2 className="mt-2 text-2xl font-bold">Send a custom quote</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Explain why this job costs more or less than the starting price. The customer must approve your quote before you can confirm the booking.</p><label className="mt-5 block text-sm font-bold">Quoted price ($)<input required type="number" min="1" max="1000000" step="0.01" value={quotePrice} onChange={(event) => setQuotePrice(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">What changed?<textarea required minLength={3} maxLength={500} rows={4} value={quoteMessage} onChange={(event) => setQuoteMessage(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="Example: The vehicle needs pet-hair removal and a deep interior treatment." /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setQuoteOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={working} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{working ? "Sending…" : "Send quote"}</button></div></form></div>}
  </>;
}

function Detail({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf2e9] font-bold">{icon}</span><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#718078]">{label}</p><p className="mt-1 font-bold">{value}</p><p className="mt-1 text-xs text-[#7d8983]">{note}</p></div></div>;
}
