"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const categories = ["Home cleaning", "Car detailing", "Lawn & garden", "Handyman", "Photography"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function OnboardingForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [business, setBusiness] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("Issaquah, WA");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("2 hours");
  const [description, setDescription] = useState("");
  const [selectedDays, setSelectedDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [saving, setSaving] = useState(false);

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1 && (!business.trim() || !category || !city.trim())) {
      setError("Complete each field to continue.");
      return;
    }
    if (step === 2 && (!service.trim() || !price || !description.trim())) {
      setError("Add your service details to continue.");
      return;
    }
    if (step === 3 && selectedDays.length === 0) {
      setError("Choose at least one available day.");
      return;
    }
    setError("");
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setSaving(true);
    const response = await fetch("/api/providers/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business, category, city, service, price, duration, description, selectedDays }),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);

    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setError(result.error ?? "We could not save your profile. Please try again.");
      return;
    }

    router.push("/provider/dashboard?welcome=1");
    router.refresh();
  }

  function toggleDay(day: string) {
    setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);
  }

  const inputClass = "w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3.5 text-sm outline-none transition focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/10";

  return (
    <div className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_24px_60px_rgba(24,49,38,.12)] sm:p-9">
      <div className="flex items-center justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Step {step} of 3</p><h2 className="mt-1 text-2xl font-bold tracking-tight">{step === 1 ? "Tell us about your business" : step === 2 ? "Create your first service" : "Set your availability"}</h2></div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#edf3e7] text-xl">{step === 1 ? "👋" : step === 2 ? "🧰" : "📅"}</span>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">{[1, 2, 3].map((number) => <span key={number} className={`h-1.5 rounded-full ${number <= step ? "bg-[#183126]" : "bg-[#dfe3df]"}`} />)}</div>

      <form onSubmit={next} className="mt-8">
        {step === 1 && <div className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold">Business name</span><input value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="e.g. Evergreen Yard Co." className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Main category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="">Choose a category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Service area</span><input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} /></label>
        </div>}

        {step === 2 && <div className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold">Service title</span><input value={service} onChange={(event) => setService(event.target.value)} placeholder="e.g. Weekly lawn care" className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Starting price</span><div className="relative"><span className="absolute left-4 top-3.5 text-sm text-[#65766d]">$</span><input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="75" className={`${inputClass} pl-8`} /></div></label><label className="block"><span className="mb-2 block text-sm font-bold">Typical duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass}>{["1 hour", "2 hours", "3 hours", "Half day", "Full day"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <label className="block"><span className="mb-2 block text-sm font-bold">What&apos;s included?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what customers can expect..." rows={4} className={`${inputClass} resize-none`} /></label>
        </div>}

        {step === 3 && <div>
          <p className="text-sm leading-6 text-[#687970]">Select the days you generally accept bookings. You can adjust individual dates later.</p>
          <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">{days.map((day) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${selectedDays.includes(day) ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/15 bg-white hover:border-[#4d725d]"}`}>{day}</button>)}</div>
          <div className="mt-7 rounded-2xl bg-[#f5f5ef] p-5"><div className="flex justify-between gap-5"><div><p className="text-sm font-bold">Typical hours</p><p className="mt-1 text-xs text-[#75837c]">Customers can request times in this window.</p></div><p className="shrink-0 text-sm font-semibold">9:00 AM–5:00 PM</p></div></div>
        </div>}

        {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}
        <div className="mt-8 flex items-center justify-between gap-4">
          {step > 1 ? <button type="button" onClick={() => { setStep(step - 1); setError(""); }} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#183126]/5">← Back</button> : <span />}
          <button type="submit" disabled={saving} className="rounded-full bg-[#eee25a] px-7 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : step === 3 ? "Finish setup" : "Continue →"}</button>
        </div>
      </form>
    </div>
  );
}
