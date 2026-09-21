"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";

type Props = { initialCategory?: string; initialTitle?: string };

export default function PostJobForm({ initialCategory = "", initialTitle = "" }: Props) {
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ id: string; matchedProviders: number } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, FormDataEntryValue | boolean>;
    values.flexible = form.get("flexible") === "true";
    const response = await fetch("/api/job-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json() as { id?: string; matchedProviders?: number; error?: string };
    setBusy(false);
    if (!response.ok || !data.id) { setError(data.error ?? "We could not post your request."); return; }
    setResult({ id: data.id, matchedProviders: data.matchedProviders ?? 0 });
  }

  if (result) return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-sm sm:p-9" role="status">
    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e2efdf] text-2xl">✓</span>
    <h2 className="mt-5 text-2xl font-bold">Your service request is live.</h2>
    <p className="mt-2 max-w-xl leading-7 text-[#65776d]">We matched it with {result.matchedProviders} {result.matchedProviders === 1 ? "provider" : "providers"} who serve your area. You will see quotes in your account, and providers never pay to respond.</p>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/account/requests" className="rounded-full bg-[#183126] px-6 py-3 text-center font-bold text-white">View my request</Link><Link href="/services" className="rounded-full border border-[#183126]/15 px-6 py-3 text-center font-bold">Browse services</Link></div>
  </section>;

  const input = "mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#faf9f5] px-4 py-3 text-base outline-none focus:border-[#50715e] focus:ring-2 focus:ring-[#dce8d8]";
  return <form onSubmit={submit} className="rounded-[2rem] border border-[#183126]/10 bg-white p-5 shadow-[0_10px_40px_rgba(24,49,38,.07)] sm:p-9">
    <div><p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#64776c]">Request a service</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Tell us what you need</h2><p className="mt-2 text-sm leading-6 text-[#687a70]">Share the details once and receive free quotes from local providers. You only pay after choosing a provider and booking.</p></div>
    <div className="mt-7 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-bold">Service category<select required name="category" defaultValue={initialCategory} className={input}><option value="">Choose a category</option>{SERVICE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="text-sm font-bold">Short title<input required minLength={3} maxLength={120} name="title" defaultValue={initialTitle} placeholder="e.g. Deep clean a two-bedroom home" className={input} /></label>
      <label className="text-sm font-bold sm:col-span-2">Describe what you need<textarea required minLength={20} maxLength={3000} name="description" rows={5} placeholder="Share the details, size, condition, and anything the provider should know." className={`${input} resize-y`} /></label>
      <label className="text-sm font-bold sm:col-span-2">Service address<input required autoComplete="street-address" name="addressLine1" placeholder="Street address" className={input} /></label>
      <label className="text-sm font-bold sm:col-span-2">Apartment, suite, or unit <span className="font-normal text-[#78877f]">(optional)</span><input autoComplete="address-line2" name="addressLine2" className={input} /></label>
      <label className="text-sm font-bold">City<input required autoComplete="address-level2" name="city" className={input} /></label>
      <div className="grid grid-cols-[1fr_1.35fr] gap-3"><label className="text-sm font-bold">State<input required maxLength={2} autoComplete="address-level1" name="state" placeholder="WA" className={input} /></label><label className="text-sm font-bold">ZIP code<input required inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" autoComplete="postal-code" name="postalCode" placeholder="98027" className={input} /></label></div>
      <label className="text-sm font-bold">Preferred date<input required type="date" min={tomorrow} name="date" className={input} /></label>
      <label className="text-sm font-bold">Preferred time<input required type="time" name="time" className={input} /></label>
      <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-[#f2f5ee] px-4 py-3 text-sm font-bold sm:col-span-2"><input type="checkbox" name="flexible" value="true" className="h-5 w-5 accent-[#183126]" />My timing is flexible</label>
      <label className="text-sm font-bold">Budget minimum <span className="font-normal text-[#78877f]">(optional)</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2">$</span><input type="number" min="0" step="1" inputMode="decimal" name="budgetMin" className={`${input} pl-8`} /></div></label>
      <label className="text-sm font-bold">Budget maximum <span className="font-normal text-[#78877f]">(optional)</span><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2">$</span><input type="number" min="0" step="1" inputMode="decimal" name="budgetMax" className={`${input} pl-8`} /></div></label>
    </div>
    {error && <p className="mt-5 rounded-2xl bg-[#fff0e7] px-4 py-3 text-sm font-bold text-[#934a28]" role="alert">{error}</p>}
    <button disabled={busy} className="mt-7 min-h-12 w-full rounded-full bg-[#eee25a] px-6 py-3.5 font-bold text-[#183126] shadow-sm disabled:opacity-60">{busy ? "Sending your request…" : "Send my request"}</button>
    <p className="mt-3 text-center text-xs leading-5 text-[#7a8981]">Your exact street address stays private until you accept a quote.</p>
  </form>;
}
