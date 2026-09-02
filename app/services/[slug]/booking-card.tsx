"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type BookingCardProps = {
  price: number;
  duration: string;
  serviceTitle: string;
  provider: string;
};

const timeSlots = ["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"];

export default function BookingCard({ price, duration, serviceTitle, provider }: BookingCardProps) {
  const [location, setLocation] = useState("Issaquah, WA");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [step, setStep] = useState<"details" | "times" | "confirmed">("details");
  const [error, setError] = useState("");

  function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location.trim() || !date) {
      setError("Add a location and date to see available times.");
      return;
    }
    setError("");
    setStep("times");
  }

  function confirmRequest() {
    if (!time) {
      setError("Choose an available time to continue.");
      return;
    }
    setError("");
    setStep("confirmed");
  }

  if (step === "confirmed") {
    return (
      <div className="sticky top-8 rounded-[2rem] border border-[#183126]/10 bg-white p-7 text-center shadow-[0_20px_50px_rgba(24,49,38,.12)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e5f1e7] text-3xl text-[#33704a]">✓</span>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[#6a7c72]">Request sent</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">You&apos;re on {provider}&apos;s calendar.</h2>
        <p className="mt-3 text-sm leading-6 text-[#6c7b74]">We&apos;ve requested {date} at {time}. You&apos;ll receive a confirmation before anything is charged.</p>
        <div className="mt-6 rounded-2xl bg-[#f7f6f1] p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-wider text-[#78867f]">Booking summary</p>
          <p className="mt-2 font-bold">{serviceTitle}</p>
          <p className="mt-1 text-sm text-[#6c7b74]">{location} · from ${price}</p>
        </div>
        <Link href="/account" className="mt-5 block w-full rounded-full bg-[#183126] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#294a3a]">View my bookings</Link>
        <button onClick={() => { setStep("details"); setTime(""); }} className="mt-6 text-sm font-bold underline decoration-[#c2b842] decoration-2 underline-offset-4">Make another request</button>
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
          <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setTime(""); setStep("details"); }} className="w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10" />
        </label>

        {step === "times" && (
          <fieldset className="pt-2">
            <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-[#708078]">Available times</legend>
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot) => (
                <button key={slot} type="button" onClick={() => { setTime(slot); setError(""); }} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${time === slot ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/15 bg-white hover:border-[#4d725d]"}`}>{slot}</button>
              ))}
            </div>
          </fieldset>
        )}

        {error && <p role="alert" className="rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}

        {step === "details" ? (
          <button type="submit" className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Check availability</button>
        ) : (
          <button type="button" onClick={confirmRequest} className="mt-3 w-full rounded-full bg-[#eee25a] px-6 py-4 font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Request this time</button>
        )}
      </form>

      <p className="mt-4 text-center text-xs leading-5 text-[#7c8a83]">No charge yet. You&apos;ll confirm the details before booking.</p>
      <div className="mt-6 border-t border-[#183126]/10 pt-6">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e8f2e9] text-xl">✓</span><div><p className="text-sm font-bold">BookMe Promise</p><p className="text-xs text-[#76847d]">Vetted providers and secure booking</p></div></div>
      </div>
    </div>
  );
}
