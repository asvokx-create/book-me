"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type BookingCardProps = {
  serviceId: string;
  price: number;
  duration: string;
  serviceTitle: string;
  provider: string;
};

function formatTime(time: string) {
  const [hoursText, minutes] = time.split(":");
  const hours = Number(hoursText);
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
}

export default function BookingCard({ serviceId, price, duration, serviceTitle, provider }: BookingCardProps) {
  const [location, setLocation] = useState("Issaquah, WA");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [step, setStep] = useState<"details" | "times" | "confirmed">("details");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);

  async function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location.trim() || !date) {
      setError("Add a location and date to see available times.");
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
      body: JSON.stringify({ serviceId, date, time, location }),
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
      <div className="sticky top-8 rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_20px_50px_rgba(24,49,38,.12)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e5f1e7] text-3xl text-[#33704a]">✓</span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#6a7c72]">Request sent</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">Your request is on its way to {provider}.</h2>
        <p className="mt-3 text-sm leading-6 text-[#6c7b74]">We&apos;ve requested {date} at {formatTime(time)}. You&apos;ll receive a confirmation before anything is charged.</p>
        <div className="mt-6 rounded-2xl bg-[#f7f6f1] p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[#78867f]">Booking summary</p>
          <p className="mt-2 font-bold">{serviceTitle}</p>
          <p className="mt-1 text-sm text-[#6c7b74]">{location} · from ${price}</p>
        </div>
        <Link href="/account" className="mt-5 block w-full rounded-full bg-[#183126] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#294a3a]">View my bookings</Link>
        <button onClick={() => { setStep("details"); setTime(""); setTimeSlots([]); }} className="mt-6 rounded-full px-4 py-2 text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4 transition hover:bg-[#eee25a]">Make another request</button>
      </div>
    );
  }

  return (
    <div className="sticky top-8 rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_20px_50px_rgba(24,49,38,.12)] sm:p-7">
      <div className="flex items-end justify-between">
        <div><p className="text-sm text-[#6f7f77]">Starting at</p><p className="mt-1 text-3xl font-bold tracking-tight">${price}</p></div>
        <p className="rounded-full bg-[#f1f0eb] px-3 py-1.5 text-xs font-semibold text-[#5f7067]">{duration}</p>
      </div>

      <form onSubmit={checkAvailability} className="mt-7 space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#708078]">Location</span>
          <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#708078]">Preferred date</span>
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setTime(""); setTimeSlots([]); setStep("details"); }} className="w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" />
        </label>

        {step === "times" && (
          <fieldset className="pt-2">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-[#708078]">Available times</legend>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot) => (
                <button key={slot} type="button" onClick={() => { setTime(slot); setError(""); }} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${time === slot ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/15 bg-white hover:border-[#8f8421] hover:bg-[#fff7ad]"}`}>{formatTime(slot)}</button>
              ))}
            </div>
            {timeSlots.length === 0 && <p className="rounded-xl bg-[#f5f5ef] p-4 text-center text-sm text-[#708078]">No times are available on this date. Try another day.</p>}
          </fieldset>
        )}

        {error && <div role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}{requiresLogin && <Link href="/login" className="ml-1 underline">Log in here.</Link>}</div>}

        {step === "details" ? (
          <button type="submit" disabled={loading} className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-wait disabled:opacity-60">{loading ? "Checking…" : "Check availability"}</button>
        ) : (
          <button type="button" onClick={confirmRequest} disabled={loading || !time} className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-not-allowed disabled:opacity-55">{loading ? "Sending request…" : "Request this time"}</button>
        )}
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-[#7c8a83]">No charge yet. The provider will confirm your request before the time is reserved.</p>
      <div className="mt-6 border-t border-[#183126]/10 pt-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e8f2e9] text-xl">✓</span><div><p className="text-sm font-bold">BookMe Promise</p><p className="text-xs text-[#76847d]">Vetted providers and secure booking</p></div></div>
      </div>
    </div>
  );
}
