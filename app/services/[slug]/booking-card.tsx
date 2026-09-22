"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import BookingDatePicker from "@/components/booking-date-picker";

type BookingCardProps = {
  serviceId: string;
  price: number;
  duration: string;
  serviceTitle: string;
  provider: string;
  serviceCity: string;
  serviceState: string;
  isSignedIn: boolean;
  returnPath: string;
  cancellationPolicy: string;
  cancellationWindowHours: number;
  noShowPolicy: string;
  bookingQuestions: string[];
  bookingDisabled?: boolean;
  parentBookingId?: string;
  requestAnotherTimeHref: string;
};

function formatTime(time: string) {
  const [hoursText, minutes] = time.split(":");
  const hours = Number(hoursText);
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export default function BookingCard({ serviceId, price, duration, serviceTitle, provider, serviceCity, serviceState, isSignedIn, returnPath, cancellationPolicy, cancellationWindowHours, noShowPolicy, bookingQuestions, bookingDisabled = false, parentBookingId = "", requestAnotherTimeHref }: BookingCardProps) {
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(serviceCity);
  const [state, setState] = useState(serviceState);
  const [postalCode, setPostalCode] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [step, setStep] = useState<"details" | "times" | "confirmed">("details");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [showFullyBooked, setShowFullyBooked] = useState(false);
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  async function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bookingDisabled) {
      setError("");
      setShowFullyBooked(true);
      return;
    }
    if (!addressLine1.trim() || !city.trim() || !/^[A-Za-z]{2}$/.test(state.trim()) || !/^\d{5}(?:-\d{4})?$/.test(postalCode.trim()) || !date) {
      setError("Add a complete US service address and date to see available times.");
      return;
    }
    setError("");
    setLoading(true);
    const response = await fetch(`/api/services/${serviceId}/availability?date=${encodeURIComponent(date)}`).catch(() => null);
    if (!response) {
      setLoading(false);
      setError("We could not check availability. Please try again.");
      return;
    }
    const data = await response.json() as { times?: string[]; error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "We could not check availability. Please try again.");
      return;
    }
    setTimeSlots(data.times ?? []);
    setStep("times");
  }

  async function confirmRequest() {
    if (!time) {
      setError("Choose an available time to continue.");
      return;
    }
    setError("");
    setRequiresLogin(false);
    setLoading(true);
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, date, time, addressLine1, addressLine2, city, state, postalCode, accessInstructions, notes, answers, parentBookingId }),
    }).catch(() => null);
    if (!response) {
      setLoading(false);
      setError("We could not send your request. Please try again.");
      return;
    }
    const data = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setRequiresLogin(response.status === 401);
      setError(data.error ?? "We could not send your request. Please try again.");
      if (response.status === 409) {
        setTime("");
        setStep("details");
      }
      return;
    }
    setStep("confirmed");
  }

  if (step === "confirmed") {
    return (
      <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_20px_50px_rgba(24,49,38,.12)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e5f1e7] text-3xl text-[#33704a]">✓</span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#6a7c72]">Request sent</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Your request is on its way to {provider}.</h2>
        <p className="mt-3 text-sm leading-6 text-[#6c7b74]">We&apos;ve requested {date} at {formatTime(time)}. You&apos;ll receive a confirmation before anything is charged.</p>
        <div className="mt-6 rounded-2xl bg-[#f7f6f1] p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[#78867f]">Booking summary</p>
          <p className="mt-2 font-bold">{serviceTitle}</p>
          <p className="mt-1 text-sm text-[#6c7b74]">{addressLine1}{addressLine2 ? `, ${addressLine2}` : ""}, {city}, {state.toUpperCase()} {postalCode} · from ${price}</p>
        </div>
        <Link href="/account" className="mt-5 block w-full rounded-full bg-[#183126] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#294a3a]">View my bookings</Link>
        <button onClick={() => { setStep("details"); setTime(""); setTimeSlots([]); }} className="mt-6 rounded-full px-4 py-2 text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">Make another request</button>
      </div>
    );
  }

  if (!isSignedIn) {
    const redirect = encodeURIComponent(returnPath);
    return <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_20px_50px_rgba(24,49,38,.12)]"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7eee2] text-2xl">🔒</span><p className="mt-5 text-xs font-bold uppercase tracking-[.16em] text-[#6a7c72]">Account required</p><h2 className="mt-2 text-2xl font-bold">Log in to book this service</h2><p className="mt-3 text-sm leading-6 text-[#6c7b74]">Every customer needs their own BubsBookings account so bookings, messages, and safety records stay with the right person.</p><div className="mt-6 grid gap-3"><Link href={`/login?redirect=${redirect}`} className="rounded-full bg-[#183126] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#315846]">Log in</Link><Link href={`/signup?redirect=${redirect}`} className="rounded-full bg-[#eee25a] px-6 py-3.5 text-sm font-bold transition hover:bg-[#e1d43d]">Create an account</Link></div></div>;
  }

  return (
    <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_20px_50px_rgba(24,49,38,.12)] sm:p-7">
      <div className="flex items-end justify-between">
        <div><p className="text-sm text-[#6f7f77]">Starting at</p><p className="mt-1 text-3xl font-bold tracking-tight">${price}</p></div>
        <p className="rounded-full bg-[#f1f0eb] px-3 py-1.5 text-xs font-semibold text-[#5f7067]">Estimated time: {duration}</p>
      </div>

      <form onSubmit={checkAvailability} className="mt-7 space-y-3">
        {bookingQuestions.map((question) => <label key={question} className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#708078]">{question}</span><textarea required={!bookingDisabled} value={answers[question] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question]: event.target.value }))} maxLength={500} rows={2} className="w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" /></label>)}
        <section className="rounded-2xl bg-[#f5f7f2] p-4">
          <div className="mb-4 flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm">⌖</span><div><h3 className="text-sm font-bold">Where do you need the service?</h3><p className="mt-0.5 text-xs leading-5 text-[#6d7c75]">Your street address stays private until the provider accepts.</p></div></div>
          <div className="space-y-3">
            <label className="block"><span className="sr-only">Street address</span><input required={!bookingDisabled} autoComplete="address-line1" maxLength={120} value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} placeholder="Street address" className="w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" /></label>
            <label className="block"><span className="sr-only">City</span><input required={!bookingDisabled} autoComplete="address-level2" maxLength={80} value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#4d725d]" /></label>
            <div className="grid grid-cols-[84px_1fr] gap-2"><label className="block"><span className="sr-only">State</span><input required={!bookingDisabled} autoComplete="address-level1" inputMode="text" maxLength={2} value={state} onChange={(event) => setState(event.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} placeholder="State" className="w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 text-sm uppercase outline-none focus:border-[#4d725d]" /></label><label className="block"><span className="sr-only">ZIP code</span><input required={!bookingDisabled} autoComplete="postal-code" inputMode="numeric" maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/[^0-9-]/g, ""))} placeholder="ZIP code" className="w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3 text-sm outline-none focus:border-[#4d725d]" /></label></div>
            <details className="group rounded-xl border border-[#183126]/10 bg-white"><summary className="booking-detail-toggle cursor-pointer list-none font-bold text-[#52665b] marker:hidden">+ Add unit or arrival instructions</summary><div className="space-y-3 border-t border-[#183126]/8 p-3"><label className="block"><span className="mb-1.5 block text-xs font-bold">Apartment, unit, or suite</span><input autoComplete="address-line2" maxLength={80} value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Apt 4B" className="w-full rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#4d725d]" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Arrival or parking instructions</span><textarea value={accessInstructions} onChange={(event) => setAccessInstructions(event.target.value)} maxLength={500} rows={2} placeholder="Parking, entrance, or other helpful directions. No alarm or access codes." className="w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none focus:border-[#4d725d]" /></label></div></details>
          </div>
        </section>
        <details className="rounded-2xl border border-[#183126]/10 bg-white"><summary className="booking-detail-toggle cursor-pointer list-none font-bold text-[#52665b] marker:hidden">+ Add booking notes</summary><div className="border-t border-[#183126]/8 p-3"><label className="block"><span className="sr-only">Booking notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} placeholder="Describe what you need or anything the provider should know. Keep addresses, passwords, and payment information out of this box." className="w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" /></label></div></details>
        <div className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#708078]">Preferred date</span>
          <BookingDatePicker serviceId={serviceId} value={date} disabled={bookingDisabled} onChange={(nextDate) => { setDate(nextDate); setTime(""); setTimeSlots([]); setStep("details"); setError(""); }} />
        </div>

        {step === "times" && (
          <fieldset className="pt-2">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-[#708078]">Available times</legend>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot) => (
                <button key={slot} type="button" onClick={() => { setTime(slot); setError(""); }} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${time === slot ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/15 bg-white hover:border-[#8f8421] hover:bg-[#fff7ad]"}`}>{formatTime(slot)}</button>
              ))}
            </div>
            {timeSlots.length === 0 && <div className="rounded-xl bg-[#f5f5ef] p-4 text-center text-sm text-[#708078]"><p>No times are available on this date.</p><Link href={requestAnotherTimeHref} className="mt-3 inline-flex rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white">Request another time</Link></div>}
          </fieldset>
        )}

        {error && <div role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}{requiresLogin && <Link href={`/login?redirect=${encodeURIComponent(returnPath)}`} className="ml-1 underline">Log in here.</Link>}</div>}

        {step === "details" ? (
          <button type="submit" disabled={loading} className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:bg-[#f5ea6b] disabled:cursor-wait disabled:opacity-60">{loading ? "Checking…" : "Check availability"}</button>
        ) : (
          <button type="button" onClick={confirmRequest} disabled={loading || !time} className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:bg-[#f5ea6b] disabled:cursor-not-allowed disabled:opacity-55">{loading ? "Sending request…" : "Request this time"}</button>
        )}

        {showFullyBooked && <div role="alert" className="rounded-2xl border border-[#e5d45a] bg-[#fff5cf] p-4 text-sm text-[#6d5d16]"><p className="font-bold text-[#183126]">This service is fully booked</p><p className="mt-1 leading-6">There are no appointments available right now. Please come back later to check for new availability.</p></div>}
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-[#7c8a83] lg:hidden">No charge yet. The provider will confirm your request before the time is reserved. Text is checked by the BubsBookings Safety Bot.</p>
      <div className="mt-4 rounded-2xl bg-[#f5f5ef] p-4 lg:hidden"><p className="text-xs font-bold">Cancellation policy · {cancellationWindowHours}h notice</p><p className="mt-1 text-xs leading-5 text-[#718078]">{cancellationPolicy}</p><p className="mt-3 text-xs font-bold">No-show policy</p><p className="mt-1 text-xs leading-5 text-[#718078]">{noShowPolicy}</p></div>
      <div className="mt-6 border-t border-[#183126]/10 pt-6 lg:hidden">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e8f2e9] text-xl">✓</span><div><p className="text-sm font-bold">BubsBookings Promise</p><p className="text-xs text-[#76847d]">Clear provider details and secure payment tools</p></div></div>
      </div>
    </div>
  );
}
