"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ServiceDemandCapture({ query, category, location, radiusMiles }: { query: string; category: string; location: string; radiusMiles: number }) {
  const initialService = query || (category !== "All services" ? category : "");
  const [serviceNeeded, setServiceNeeded] = useState(initialService);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/service-demand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, serviceNeeded, category: category === "All services" ? "" : category, location, radiusMiles, consent }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "We could not save your request. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) return <div className="mt-8 rounded-2xl bg-[#e8f2e5] p-5 text-left"><p className="font-bold text-[#34704a]">Request saved</p><p className="mt-1 text-sm leading-6 text-[#587064]">We&apos;ll use this demand to recruit the right providers and email you when matching supply becomes available.</p></div>;

  return <form onSubmit={submit} className="mx-auto mt-8 max-w-xl rounded-[1.5rem] border border-[#183126]/10 bg-[#f5f6f1] p-5 text-left sm:p-6">
    <h4 className="text-lg font-bold">Tell us what you need</h4>
    <p className="mt-1 text-sm leading-6 text-[#687970]">Join the local availability list. This helps us recruit providers for real customer demand.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Service needed<input required minLength={2} maxLength={160} value={serviceNeeded} onChange={(event) => setServiceNeeded(event.target.value)} placeholder="e.g. House cleaning" className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#4d725d]" /></label><label className="text-sm font-bold">Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-white px-4 py-3 font-normal outline-none focus:border-[#4d725d]" /></label></div>
    <label className="mt-4 flex items-start gap-3 text-xs leading-5 text-[#61736a]"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#183126]" /><span>BubsBookings may email me about matching providers for this request. I can withdraw consent through support at any time. See the <Link href="/privacy" className="font-bold underline">Privacy Policy</Link>.</span></label>
    {error && <p role="alert" className="mt-3 text-xs font-bold text-[#97492f]">{error}</p>}
    <button disabled={busy} className="mt-4 w-full rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#e3d63f] disabled:opacity-55">{busy ? "Saving request…" : "Notify me when providers are available"}</button>
  </form>;
}
