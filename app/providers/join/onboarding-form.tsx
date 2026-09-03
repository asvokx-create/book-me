"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
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
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const previewUrls = useRef<string[]>([]);

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Use JPG, PNG, or WebP photos under 5 MB each.");
      return;
    }
    if (photos.length + selected.length > 5) {
      setError(`You can add up to 5 photos.`);
      return;
    }
    setError("");
    const additions = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      previewUrls.current.push(preview);
      return { file, preview };
    });
    setPhotos((current) => [...current, ...additions]);
  }

  function removePhoto(preview: string) {
    URL.revokeObjectURL(preview);
    previewUrls.current = previewUrls.current.filter((url) => url !== preview);
    setPhotos((current) => current.filter((photo) => photo.preview !== preview));
  }

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
    if (step === 3 && (selectedDays.length === 0 || startTime >= endTime)) {
      setError(selectedDays.length === 0 ? "Choose at least one available day." : "Your start time must be earlier than your end time.");
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
      body: JSON.stringify({ business, category, city, service, price, duration, description, selectedDays, startTime, endTime }),
    });
    const result = (await response.json()) as { error?: string; serviceId?: string };

    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setSaving(false);
      setError(result.error ?? "We could not save your profile. Please try again.");
      return;
    }

    let photoUploadFailed = false;
    if (photos.length > 0 && result.serviceId) {
      for (const photo of photos) {
        const formData = new FormData();
        formData.set("image", photo.file);
        const imageResponse = await fetch(`/api/providers/services/${result.serviceId}/images`, { method: "POST", body: formData });
        if (!imageResponse.ok) {
          photoUploadFailed = true;
          break;
        }
      }
    }

    router.push(`/provider/dashboard?welcome=1${photoUploadFailed ? "&photos=failed" : ""}`);
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
          <label className="block"><span className="mb-2 block text-sm font-bold">Business name</span><input value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="Your business name" className={inputClass} /></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Main category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="">Choose a category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">Service area</span><input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} /></label>
        </div>}

        {step === 2 && <div className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold">Service title</span><input value={service} onChange={(event) => setService(event.target.value)} placeholder="e.g. Weekly lawn care" className={inputClass} /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-bold">Starting price</span><div className="relative"><span className="absolute left-4 top-3.5 text-sm text-[#65766d]">$</span><input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="75" className={`${inputClass} pl-8`} /></div></label><label className="block"><span className="mb-2 block text-sm font-bold">Typical duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)} className={inputClass}>{["1 hour", "2 hours", "3 hours", "Half day", "Full day"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <label className="block"><span className="mb-2 block text-sm font-bold">What&apos;s included?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what customers can expect..." rows={4} className={`${inputClass} resize-none`} /></label>
          <div className="rounded-2xl border border-dashed border-[#183126]/20 bg-[#faf9f5] p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-bold">Listing photos <span className="font-normal text-[#7a8881]">(optional)</span></p><p className="mt-1 text-xs leading-5 text-[#74827b]">Add up to 5 JPG, PNG, or WebP photos. The first becomes your cover.</p></div><span className="text-xl">📷</span></div>
            {photos.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">{photos.map((photo, index) => <div key={photo.preview} className="relative aspect-square"><div role="img" aria-label={`Selected listing photo ${index + 1}`} style={{ backgroundImage: `url("${photo.preview}")` }} className="h-full rounded-xl bg-cover bg-center" />{index === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold">Cover</span>}<button type="button" onClick={() => removePhoto(photo.preview)} aria-label={`Remove photo ${index + 1}`} className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#183126] text-xs text-white shadow transition hover:bg-[#b24f42]">×</button></div>)}</div>}
            <label className="mt-4 inline-flex cursor-pointer rounded-full border border-[#183126]/15 bg-white px-4 py-2.5 text-xs font-bold hover:border-[#4d725d]">{photos.length === 0 ? "+ Choose photos" : "+ Add more"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos} className="sr-only" /></label>
          </div>
        </div>}

        {step === 3 && <div>
          <p className="text-sm leading-6 text-[#687970]">Select the days you generally accept bookings. You can adjust individual dates later.</p>
          <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-7">{days.map((day) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-xl border px-2 py-3 text-sm font-bold transition ${selectedDays.includes(day) ? "border-[#183126] bg-[#183126] text-white" : "border-[#183126]/15 bg-white hover:border-[#4d725d]"}`}>{day}</button>)}</div>
          <div className="mt-7 rounded-2xl bg-[#f5f5ef] p-5"><div><p className="text-sm font-bold">Typical hours</p><p className="mt-1 text-xs text-[#75837c]">These hours will apply to the selected days. You can customize each day later.</p></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><label><span className="mb-2 block text-xs font-bold text-[#65766d]">Start time</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inputClass} /></label><span className="mt-6 text-sm text-[#718078]">to</span><label><span className="mb-2 block text-xs font-bold text-[#65766d]">End time</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={inputClass} /></label></div></div>
        </div>}

        {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff1e8] px-3 py-2.5 text-xs font-semibold text-[#9a4e25]">{error}</p>}
        <div className="mt-8 flex items-center justify-between gap-4">
          {step > 1 ? <button type="button" onClick={() => { setStep(step - 1); setError(""); }} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#183126]/5">← Back</button> : <span />}
          <button type="submit" disabled={saving} className="rounded-full bg-[#eee25a] px-7 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b] disabled:cursor-wait disabled:opacity-60">{saving ? photos.length > 0 ? "Saving & uploading…" : "Saving…" : step === 3 ? "Finish setup" : "Continue →"}</button>
        </div>
      </form>
    </div>
  );
}
