"use client";

import { FormEvent, useState } from "react";

const input = "w-full rounded-2xl border border-[#183126]/15 bg-white px-4 py-3.5 text-base outline-none focus:border-[#4d725d] focus:ring-2 focus:ring-[#4d725d]/15";

export default function PartnerApplicationForm() {
  const [status, setStatus] = useState<"idle" | "saving" | "sent">("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("saving"); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/affiliates/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setStatus("idle"); setError(result.error ?? "We could not submit your application."); return; }
    setStatus("sent");
  }
  if (status === "sent") return <div className="rounded-[2rem] border border-[#8eaa91] bg-[#edf5e9] p-7"><h2 className="text-2xl font-bold">Application received</h2><p className="mt-2 leading-7 text-[#5d7066]">We will review your audience, promotion plan, and program fit. Applying does not automatically approve or activate an affiliate account.</p></div>;
  return <form onSubmit={submit} className="rounded-[2rem] border border-[#183126]/10 bg-[#f7f7f2] p-5 sm:p-8">
    <h2 className="text-2xl font-bold">Apply to become a partner</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Tell us who you reach and how you plan to introduce legitimate service providers to BubsBookings.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="font-bold">Name<input name="name" required autoComplete="name" className={`${input} mt-2`} /></label>
      <label className="font-bold">Email<input name="email" required type="email" autoComplete="email" className={`${input} mt-2`} /></label>
      <label className="font-bold">Website <span className="font-normal text-[#718078]">(optional)</span><input name="website" type="url" inputMode="url" className={`${input} mt-2`} /></label>
      <label className="font-bold">Audience size <span className="font-normal text-[#718078]">(optional)</span><input name="audienceSize" className={`${input} mt-2`} placeholder="e.g. 10,000 subscribers" /></label>
      <label className="font-bold">YouTube <span className="font-normal text-[#718078]">(optional)</span><input name="youtube" type="url" className={`${input} mt-2`} /></label>
      <label className="font-bold">Instagram <span className="font-normal text-[#718078]">(optional)</span><input name="instagram" type="url" className={`${input} mt-2`} /></label>
      <label className="font-bold">TikTok <span className="font-normal text-[#718078]">(optional)</span><input name="tiktok" type="url" className={`${input} mt-2`} /></label>
      <label className="font-bold">Other social profile <span className="font-normal text-[#718078]">(optional)</span><input name="otherSocial" type="url" className={`${input} mt-2`} /></label>
    </div>
    <label className="mt-4 block font-bold">Who is your primary audience?<textarea name="primaryAudience" required minLength={10} rows={3} className={`${input} mt-2 resize-y`} /></label>
    <label className="mt-4 block font-bold">How will you promote BubsBookings?<textarea name="promotionPlan" required minLength={30} rows={5} className={`${input} mt-2 resize-y`} /></label>
    <label className="mt-4 block font-bold">Additional notes <span className="font-normal text-[#718078]">(optional)</span><textarea name="notes" rows={3} className={`${input} mt-2 resize-y`} /></label>
    <p className="mt-5 text-xs leading-5 text-[#687970]">Partners must clearly disclose compensated links, avoid misleading claims, and may only refer legitimate new providers. Commissions are subject to qualification, refund, dispute, fraud, and holding-period rules.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff1e8] p-3 text-sm font-bold text-[#9a4e25]">{error}</p>}
    <button disabled={status === "saving"} className="mt-5 min-h-12 w-full rounded-full bg-[#eee25a] px-6 py-3.5 font-bold disabled:opacity-60">{status === "saving" ? "Submitting…" : "Submit application"}</button>
  </form>;
}
