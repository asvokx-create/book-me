"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import ReportUserButton from "@/components/report-user-button";
import { formatInUserTimeZone, useUserTimeZone } from "@/components/preferences-provider";

type BookingStatus = "requested" | "confirmed" | "completed" | "cancelled";
type Booking = {
  id: string;
  viewerRole: "customer" | "provider" | "worker";
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
  bookingAnswers: Record<string, string>;
  price: number;
  customerServiceFee: number;
  customerServiceFeeRefunded: number;
  paymentStatus: "unpaid" | "pending" | "paid" | "refunded" | "failed";
  paidAt: string | null;
  paymentRelease: {
    status: "not_applicable" | "awaiting_payment" | "secured" | "awaiting_customer" | "processing" | "paid_out" | "partially_released" | "frozen" | "reversed" | "failed";
    platformFee: number; providerPayout: number; confirmationDueAt: string | null; customerConfirmedAt: string | null;
    releasedAt: string | null; failureReason: string | null; freezeReason: string | null;
  };
  refund: { status: "none" | "requested" | "processing" | "refunded" | "rejected" | "failed"; reason: string | null; requestedAmount: number | null; refundedAmount: number; failureReason: string | null };
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
  ownerName: string;
  assignedProfessionals: Array<{ memberId: string | null; name: string }>;
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
  const timeZone = useUserTimeZone();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
    if (!response?.ok || !result?.booking || (expectedRole === "customer" ? result.booking.viewerRole !== "customer" : result.booking.viewerRole === "customer")) {
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
      if (new URLSearchParams(window.location.search).get("payment") === "success") setNotice("Payment submitted securely through Stripe. Your receipt and payment status will appear after confirmation.");
      if (new URLSearchParams(window.location.search).get("payment") === "cancelled") {
        setNotice("Payment checkout was cancelled. Nothing was charged.");
        void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: "checkout_abandoned", path: window.location.pathname, metadata: { bookingId } }) });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookingId, loadBooking]);

  async function providerAction(action: "accepted" | "declined" | "completed" | "cancel" | "approve_reschedule" | "decline_reschedule", reason = "") {
    setWorking(true);
    setError("");
    const response = await fetch(`/api/providers/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string; refundWarning?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not update this booking.");
    else {
      setCancelOpen(false);
      setCancelReason("");
      if (result?.refundWarning) setError(result.refundWarning);
      await loadBooking();
    }
    setWorking(false);
  }

  async function requestReschedule(event: FormEvent) {
    event.preventDefault();
    setWorking(true); setError("");
    const response = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_reschedule", startsAt: new Date(rescheduleDate).toISOString(), reason: rescheduleReason }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string; refundWarning?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not send your reschedule request.");
    else { setRescheduleOpen(false); setRescheduleDate(""); setRescheduleReason(""); await loadBooking(); }
    setWorking(false);
  }

  async function assignBooking(memberIds: string[]) {
    if (!memberIds.length) { setError("Assign at least one professional to this booking."); return; }
    setWorking(true); setError("");
    const response = await fetch(`/api/providers/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign", memberIds }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string; refundWarning?: string } : null;
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

  async function payForBooking() {
    setWorking(true); setError(""); setNotice("");
    const response = await fetch(`/api/stripe/bookings/${bookingId}/checkout`, { method: "POST" }).catch(() => null);
    const result = response ? await response.json() as { url?: string; error?: string } : null;
    if (!response?.ok || !result?.url) {
      setError(result?.error ?? "We could not open secure payment.");
      setWorking(false);
      return;
    }
    window.location.assign(result.url);
  }

  async function refundAction(action: "request" | "approve" | "reject") {
    if (!booking) return;
    let reason = "";
    let amount: number | undefined;
    if (action === "request") {
      reason = window.prompt("Why are you requesting a refund?")?.trim() ?? "";
      if (!reason) return;
    }
    if (action === "approve") {
      const entered = window.prompt("Refund amount in dollars", String(booking.refund.requestedAmount ?? booking.price));
      if (entered === null) return;
      amount = Number(entered);
      if (!Number.isFinite(amount)) { setError("Enter a valid refund amount."); return; }
      const returnsServiceFee = amount >= booking.price - booking.refund.refundedAmount && booking.customerServiceFee > booking.customerServiceFeeRefunded;
      if (!window.confirm(`Approve a $${amount.toFixed(2)} service refund to the original payment method?${returnsServiceFee ? ` The $${(booking.customerServiceFee - booking.customerServiceFeeRefunded).toFixed(2)} service fee will also be returned.` : ""}`)) return;
    }
    if (action === "reject") {
      reason = window.prompt("Why are you declining this refund request?")?.trim() ?? "";
      if (!reason) return;
    }
    setWorking(true); setError(""); setNotice("");
    const response = await fetch(`/api/bookings/${bookingId}/refund`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason, amount }) }).catch(() => null);
    const result = response ? await response.json() as { error?: string; amount?: number } : null;
    if (!response?.ok) setError(result?.error ?? "We could not update this refund.");
    else { setNotice(action === "request" ? "Refund request sent to the provider." : action === "approve" ? `A $${result?.amount?.toFixed(2)} refund was sent to the original payment method.` : "Refund request declined."); await loadBooking(); }
    setWorking(false);
  }

  async function confirmCompletion() {
    if (!window.confirm("Confirm that the service is complete and release the provider's payout?")) return;
    setWorking(true); setError(""); setNotice("");
    const response = await fetch(`/api/bookings/${bookingId}/completion`, { method: "POST" }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not release this payout.");
    else { setNotice("Service confirmed. The provider's payout was released to Stripe."); await loadBooking(); }
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
    const result = response ? await response.json() as { error?: string; refundWarning?: string } : null;
    if (!response?.ok) setError(result?.error ?? "We could not cancel this booking.");
    else {
      setCancelOpen(false);
      setCancelReason("");
      if (result?.refundWarning) setError(result.refundWarning);
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
  const releaseCopy = paymentReleaseCopy(booking, timeZone);
  const customerPaymentTotal = booking.price + booking.customerServiceFee;
  const selectedProfessionalIds = booking.assignedProfessionals.map((professional) => professional.memberId ?? "owner");
  const toggleProfessional = (memberId: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedProfessionalIds, memberId]))
      : selectedProfessionalIds.filter((selected) => selected !== memberId);
    void assignBooking(next);
  };

  return <>
    {notice && <p role="status" className="mb-5 rounded-2xl bg-[#e6f2e6] px-5 py-4 text-sm font-semibold text-[#34704a]">{notice}</p>}
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
          <Detail icon="◷" label="Date and time" value={formatInUserTimeZone(start, { weekday: "long", month: "long", day: "numeric", year: "numeric" }, timeZone)} note={`${formatInUserTimeZone(start, { hour: "numeric", minute: "2-digit" }, timeZone)}–${formatInUserTimeZone(end, { hour: "numeric", minute: "2-digit" }, timeZone)}`} />
          {booking.viewerRole !== "worker" && <Detail icon="$" label={booking.quote.status === "accepted" ? "Approved quote" : "Service price"} value={`$${booking.price.toLocaleString()}`} note={releaseCopy.detail} />}
          <Detail icon="⌖" label="Service location" value={booking.location} note="Shared only with this booking" />
          <Detail icon="✉" label={booking.viewerRole === "customer" ? "Service professional" : "Customer"} value={booking.viewerRole === "customer" ? booking.assigneeName : booking.customerName} note={booking.viewerRole === "customer" ? `From ${booking.providerName}` : "Message through BubsBookings"} />
        </div>

        {booking.notes && <div className="border-t border-[#183126]/10 px-6 py-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Booking notes</p><p className="mt-2 text-sm leading-6 text-[#4f6559]">{booking.notes}</p></div>}
        {Object.keys(booking.bookingAnswers ?? {}).length > 0 && <div className="border-t border-[#183126]/10 px-6 py-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Provider questions</p><div className="mt-3 space-y-3">{Object.entries(booking.bookingAnswers).map(([question, answer]) => <div key={question}><p className="text-sm font-bold">{question}</p><p className="mt-1 text-sm leading-6 text-[#4f6559]">{answer}</p></div>)}</div></div>}
        {booking.status === "cancelled" && <div className="border-t border-[#183126]/10 bg-[#fff7f3] px-6 py-5 sm:px-8"><p className="font-bold text-[#854c3b]">Cancelled by {booking.cancelledBy ?? "a booking participant"}{booking.lateCancellation ? " · Late cancellation" : ""}</p><p className="mt-2 text-sm leading-6 text-[#765e55]">{booking.cancellationReason || "No reason was provided."}</p>{booking.lateCancellation && <p className="mt-2 text-xs font-semibold text-[#854c3b]">This was cancelled inside the provider&apos;s {booking.cancellationWindowHours}-hour notice window. Any future refund decision will follow the provider policy and payment terms.</p>}</div>}
        {booking.refund.status !== "none" && <div className="border-t border-[#183126]/10 bg-[#f3f6f0] px-6 py-5 sm:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold capitalize">Refund {booking.refund.status}</p><p className="mt-1 text-sm text-[#61736a]">{booking.refund.reason || booking.refund.failureReason || `${booking.refund.refundedAmount.toFixed(2)} returned to the original payment method.`}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{booking.refund.requestedAmount ? `$${booking.refund.requestedAmount.toFixed(2)}` : "Payment refund"}</span></div></div>}
        {booking.paymentStatus === "paid" && <div className="border-t border-[#183126]/10 bg-[#f7f8f3] px-6 py-5 sm:px-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Payment progress</p><p className="mt-2 font-bold">{releaseCopy.label}</p><p className="mt-1 max-w-2xl text-sm leading-6 text-[#61736a]">{releaseCopy.detail}</p>{booking.paymentRelease.freezeReason && <p className="mt-2 text-xs font-semibold text-[#934927]">Admin hold: {booking.paymentRelease.freezeReason}</p>}</div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">Provider share ${booking.paymentRelease.providerPayout.toFixed(2)}</span></div></div>}
      </section>

      {booking.quote.status !== "none" && booking.quote.price !== null && <section className={`rounded-[2rem] border p-6 sm:p-8 ${booking.quote.status === "pending" ? "border-[#d1c653] bg-[#fff9d8]" : booking.quote.status === "accepted" ? "border-[#7eaa86] bg-[#e8f3e8]" : "border-[#d8b2a2] bg-[#fff3ee]"}`}><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Custom service quote</p><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">${booking.quote.price.toLocaleString()} quote</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7168]">{booking.quote.message}</p></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold capitalize">{booking.quote.status}</span></div>{booking.viewerRole === "customer" && booking.quote.status === "pending" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={working} onClick={() => void respondToQuote("accept_quote")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:opacity-50">Approve ${booking.quote.price.toLocaleString()}</button><button disabled={working} onClick={() => void respondToQuote("decline_quote")} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold hover:bg-[#f4d8cc] disabled:opacity-50">Decline quote</button></div>}{booking.viewerRole === "provider" && booking.quote.status === "declined" && <p className="mt-4 text-sm font-bold text-[#8a4f3d]">The customer declined this quote. You can send a revised one.</p>}</section>}
      </div>

      <aside className="space-y-5">
        <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6">
          <h2 className="text-lg font-bold">Manage this booking</h2>
          <div className="mt-5 grid gap-3">
            {booking.viewerRole === "worker" && <p className="rounded-2xl bg-[#edf2e8] p-4 text-sm leading-6 text-[#52665b]">This is an assigned company job. The company owner manages customer messages, booking changes, and payments.</p>}
            {booking.viewerRole !== "worker" && <Link href={contactHref} className="rounded-full bg-[#eee25a] px-5 py-3 text-center text-sm font-bold transition hover:bg-[#e1d43d]">✉ Contact {booking.viewerRole === "customer" ? "provider" : "customer"}</Link>}
            {booking.viewerRole === "customer" && (booking.status === "confirmed" || booking.status === "completed") && booking.paymentStatus !== "paid" && booking.paymentStatus !== "refunded" && <div className={`rounded-2xl border p-4 ${booking.status === "completed" ? "border-[#d6ca65] bg-[#fff8cd]" : "border-[#183126]/10 bg-[#f7f8f3]"}`}><p className="mb-3 font-bold">{booking.status === "completed" ? "Service completed · Payment due now" : "Pay before your appointment"}</p><div className="space-y-2 text-sm"><div className="flex justify-between gap-4 text-[#61736a]"><span>Service</span><span>${booking.price.toFixed(2)}</span></div><div className="flex justify-between gap-4 text-[#61736a]"><span>BubsBookings service fee</span><span>${booking.customerServiceFee.toFixed(2)}</span></div><div className="flex justify-between gap-4 border-t border-[#183126]/10 pt-2 font-bold"><span>Total due at checkout</span><span>${customerPaymentTotal.toFixed(2)}</span></div></div><button disabled={working} onClick={() => void payForBooking()} className="mt-4 w-full rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working ? "Opening Stripe…" : `Pay $${customerPaymentTotal.toFixed(2)} securely`}</button><p className="mt-2 text-center text-xs leading-5 text-[#7b8982]">You are charged only when you complete payment in Stripe.</p></div>}
            {booking.paymentStatus === "paid" && <div className="rounded-2xl bg-[#e6f2e6] px-4 py-3 text-center text-sm font-bold text-[#34704a]">✓ {releaseCopy.label}</div>}
            {booking.viewerRole === "customer" && (booking.paymentRelease.status === "awaiting_customer" || (booking.paymentRelease.status === "failed" && Boolean(booking.paymentRelease.customerConfirmedAt))) && <button disabled={working} onClick={() => void confirmCompletion()} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working ? "Releasing payout…" : booking.paymentRelease.status === "failed" ? "Retry payout release" : "Confirm service complete"}</button>}
            {booking.viewerRole === "customer" && booking.paymentStatus === "paid" && !["requested", "processing", "refunded"].includes(booking.refund.status) && <button disabled={working} onClick={() => void refundAction("request")} className="rounded-full border border-[#9b4e3a]/25 px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc] disabled:opacity-50">Request a refund</button>}
            {booking.viewerRole === "provider" && booking.refund.status === "requested" && <><button disabled={working} onClick={() => void refundAction("approve")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">Approve refund</button><button disabled={working} onClick={() => void refundAction("reject")} className="rounded-full border border-[#9b4e3a]/25 px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc] disabled:opacity-50">Decline refund</button></>}
            {booking.viewerRole === "provider" && canCancel && <fieldset disabled={working} className="rounded-2xl border border-[#183126]/15 bg-[#fafaf6] p-4"><legend className="px-1 text-sm font-bold">Assigned professionals</legend><p className="mb-3 text-xs font-normal text-[#718078]">Select everyone working on this job.</p><div className="grid gap-2"><label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-bold"><input type="checkbox" checked={selectedProfessionalIds.includes("owner")} onChange={(event) => toggleProfessional("owner", event.target.checked)} className="h-4 w-4 accent-[#183126]" />{booking.ownerName}</label>{booking.teamMembers.map((member) => <label key={member.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-sm font-bold"><input type="checkbox" checked={selectedProfessionalIds.includes(member.id)} onChange={(event) => toggleProfessional(member.id, event.target.checked)} className="h-4 w-4 accent-[#183126]" />{member.name}</label>)}</div></fieldset>}
            {booking.viewerRole === "provider" && booking.status === "requested" && <button disabled={working} onClick={() => { setQuotePrice(String(booking.quote.price ?? booking.price)); setQuoteMessage(booking.quote.message); setQuoteOpen(true); }} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#eee25a] disabled:opacity-50">{booking.quote.status === "none" ? "Send a custom quote" : "Send revised quote"}</button>}
            {booking.viewerRole === "customer" && canCancel && !booking.reschedule && <button onClick={() => setRescheduleOpen(true)} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#eee25a]">Request a new time</button>}
            {booking.status === "confirmed" && <a href={`/api/bookings/${booking.id}/calendar`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-center text-sm font-bold transition hover:bg-[#e5eddf]">Add to Google / Apple Calendar</a>}
            {booking.viewerRole === "provider" && booking.status === "requested" && <button disabled={working || booking.quote.status === "pending" || booking.quote.status === "declined"} onClick={() => providerAction("accepted")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-50">{booking.quote.status === "pending" ? "Waiting for quote approval" : booking.quote.status === "declined" ? "Send a revised quote" : "Accept booking"}</button>}
            {canComplete && <button disabled={working} onClick={() => providerAction("completed")} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:bg-[#e5eddf] disabled:opacity-50">Mark job complete</button>}
            {booking.viewerRole !== "worker" && canCancel && <button onClick={() => { setError(""); setCancelOpen(true); }} className="rounded-full px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline request" : "Cancel booking"}</button>}
            {booking.viewerRole !== "worker" && <ReportUserButton bookingId={booking.id} targetLabel={booking.viewerRole === "customer" ? "provider" : "customer"} />}
            {booking.viewerRole !== "worker" && booking.status !== "requested" && <Link href={`/disputes?bookingId=${booking.id}`} className="rounded-full border border-[#183126]/15 px-5 py-3 text-center text-sm font-bold transition hover:bg-[#fff3b0]">Open a dispute</Link>}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[#7b8982]">Both sides are notified whenever the booking status changes.</p>
        </div>
        <div className="rounded-[2rem] bg-[#e7eee2] p-6"><p className="text-2xl">☂</p><h2 className="mt-3 font-bold">BubsBookings Promise</h2><p className="mt-2 text-sm leading-6 text-[#61736a]">Your booking information and messages stay together in one secure place.</p></div>
      </aside>
    </div>

    {booking.reschedule && <section className="mt-6 rounded-[2rem] border border-[#d1c653] bg-[#fff9d8] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#756d3f]">Pending reschedule</p><h2 className="mt-2 text-2xl font-bold">New time requested</h2><p className="mt-3 font-bold">{formatInUserTimeZone(booking.reschedule.startsAt, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }, timeZone)}</p><p className="mt-2 text-sm text-[#6f6840]">{booking.reschedule.reason}</p>{booking.viewerRole === "provider" && <div className="mt-5 flex flex-wrap gap-2"><button disabled={working} onClick={() => providerAction("approve_reschedule")} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846]">Approve new time</button><button disabled={working} onClick={() => { const reason = window.prompt("Why are you declining this new time?"); if (reason) void providerAction("decline_reschedule", reason); }} className="rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold hover:bg-[#f4d8cc]">Decline</button></div>}</section>}

    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Activity</p><h2 className="mt-2 text-2xl font-bold">Booking history</h2><div className="mt-5 space-y-4">{booking.history.length ? booking.history.map((event) => <div key={event.id} className="flex gap-4"><span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#eee25a] ring-4 ring-[#f8f3bd]" /><div><p className="text-sm font-semibold">{event.message}</p><p className="mt-1 text-xs text-[#7a8881]">{formatInUserTimeZone(event.createdAt, { dateStyle: "medium", timeStyle: "short" }, timeZone)}</p></div></div>) : <p className="text-sm text-[#718078]">Future booking changes will be recorded here.</p>}</div></section>

    {booking.viewerRole === "customer" && booking.status === "completed" && <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Verified booking</p>
      <h2 className="mt-2 text-2xl font-bold">{booking.review ? "Your review" : "How was your service?"}</h2>
      {booking.review ? <div className="mt-5 rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xl text-[#d0a51d]">{"★".repeat(booking.review.rating)}<span className="text-[#d8ddd9]">{"★".repeat(5 - booking.review.rating)}</span></p><p className="mt-3 text-sm leading-6 text-[#52665b]">{booking.review.body}</p></div> : <form onSubmit={submitReview} className="mt-5 max-w-2xl"><div className="flex gap-1" aria-label="Rating">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className={`rounded-lg px-1 text-3xl transition hover:bg-[#fff4b5] ${star <= rating ? "text-[#d0a51d]" : "text-[#d8ddd9]"}`}>★</button>)}</div><label htmlFor="review" className="mt-5 block text-sm font-bold">Share your experience</label><textarea id="review" value={review} onChange={(event) => setReview(event.target.value)} minLength={3} maxLength={1000} rows={4} required className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="What went well? What should future customers know?" /><button disabled={working} className="mt-4 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working ? "Saving…" : "Post verified review"}</button></form>}
    </section>}

    {cancelOpen && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="cancel-title"><form onSubmit={cancelBooking} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 id="cancel-title" className="text-2xl font-bold">{booking.viewerRole === "provider" && booking.status === "requested" ? "Decline this request?" : "Cancel this booking?"}</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Give a short reason. It will be shared with the other person so they know what happened.</p>{booking.viewerRole === "customer" && booking.status === "confirmed" && <div className="mt-4 rounded-2xl bg-[#fff5cf] p-4 text-xs leading-5 text-[#6f642d]"><p className="font-bold">Provider notice window: {booking.cancellationWindowHours} hours</p><p className="mt-1">{booking.cancellationPolicy}</p><p className="mt-2">If your payment is still held, cancellations outside this notice window are refunded automatically. Late cancellations require review.</p></div>}<label htmlFor="cancellation-reason" className="mt-5 block text-sm font-bold">Reason</label><textarea id="cancellation-reason" autoFocus required minLength={3} maxLength={500} rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#6f7f4c] focus:ring-2 focus:ring-[#eee25a]/50" placeholder="For example: My schedule changed unexpectedly." /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCancelOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold transition hover:bg-[#edf1ec]">Keep booking</button><button disabled={working} className="rounded-full bg-[#9b4e3a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#7f3d2d] disabled:opacity-50">{working ? "Saving…" : "Confirm cancellation"}</button></div></form></div>}
    {rescheduleOpen && booking.viewerRole === "customer" && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true"><form onSubmit={requestReschedule} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><h2 className="text-2xl font-bold">Request a new time</h2><p className="mt-2 text-sm text-[#687970]">The provider must approve your request before the booking moves.</p><label htmlFor="reschedule-date" className="mt-5 block text-sm font-bold">New date and time</label><input id="reschedule-date" type="datetime-local" required value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /><label htmlFor="reschedule-reason" className="mt-4 block text-sm font-bold">Reason</label><textarea id="reschedule-reason" required minLength={3} maxLength={500} rows={3} value={rescheduleReason} onChange={(event) => setRescheduleReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="Why do you need a different time?" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRescheduleOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Close</button><button disabled={working} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846]">{working ? "Sending…" : "Send request"}</button></div></form></div>}
    {quoteOpen && booking.viewerRole === "provider" && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true"><form onSubmit={sendQuote} className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Before confirmation</p><h2 className="mt-2 text-2xl font-bold">Send a custom quote</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Explain why this job costs more or less than the starting price. The customer must approve your quote before you can confirm the booking.</p><label className="mt-5 block text-sm font-bold">Quoted price ($)<input required type="number" min="1" max="1000000" step="0.01" value={quotePrice} onChange={(event) => setQuotePrice(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">What changed?<textarea required minLength={3} maxLength={500} rows={4} value={quoteMessage} onChange={(event) => setQuoteMessage(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="Example: The vehicle needs pet-hair removal and a deep interior treatment." /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setQuoteOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={working} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{working ? "Sending…" : "Send quote"}</button></div></form></div>}
  </>;
}

function Detail({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  return <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf2e9] font-bold">{icon}</span><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#718078]">{label}</p><p className="mt-1 font-bold">{value}</p><p className="mt-1 text-xs text-[#7d8983]">{note}</p></div></div>;
}

function paymentReleaseCopy(booking: Booking, timeZone?: string) {
  if (booking.paymentStatus === "refunded") return { label: "Payment refunded", detail: "The payment was returned to the original payment method." };
  if (booking.paymentStatus !== "paid") return { label: booking.status === "completed" ? "Payment due" : "Payment not completed", detail: booking.status === "completed" ? "The service was marked complete and payment is now due." : booking.quote.status === "accepted" ? "Customer approved this price" : "Payment is due after booking confirmation." };
  switch (booking.paymentRelease.status) {
    case "secured": return { label: "Payment secured · Awaiting completion", detail: "Stripe has collected the payment. The provider share stays held until the service is completed." };
    case "awaiting_customer": return { label: "Awaiting completion confirmation", detail: `The provider marked the service complete. Confirm it or open a dispute${booking.paymentRelease.confirmationDueAt ? ` before ${formatInUserTimeZone(booking.paymentRelease.confirmationDueAt, { dateStyle: "medium", timeStyle: "short" }, timeZone)}` : " within 48 hours"}.` };
    case "processing": return { label: "Payout processing", detail: "The provider payout is being released through Stripe." };
    case "paid_out": return { label: "Paid out", detail: "The provider's full share has been released to their Stripe balance." };
    case "partially_released": return { label: "Partially released", detail: "Part of the provider payout was reversed because of a partial refund." };
    case "frozen": return { label: "Payout on hold", detail: "An administrator paused this payout while the booking is reviewed." };
    case "reversed": return { label: "Payout reversed", detail: "The provider payout was withheld or reversed because the payment was refunded." };
    case "failed": return { label: "Payout needs attention", detail: booking.paymentRelease.failureReason || "Stripe could not release this payout. BubsBookings support has been notified." };
    default: return { label: "Payment complete", detail: "Paid securely through Stripe." };
  }
}
