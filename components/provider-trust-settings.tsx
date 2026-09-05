"use client";

import { FormEvent, useState } from "react";

type TrustSettings = {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  businessVerified: boolean;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  noShowPolicy: string;
};

export default function ProviderTrustSettings({ initial }: { initial: TrustSettings }) {
  const [hours, setHours] = useState(String(initial.cancellationWindowHours));
  const [policy, setPolicy] = useState(initial.cancellationPolicy);
  const [noShowPolicy, setNoShowPolicy] = useState(initial.noShowPolicy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const response = await fetch("/api/providers/trust-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationWindowHours: Number(hours), cancellationPolicy: policy, noShowPolicy }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not save your policy."); return; }
    setMessage("Cancellation policy saved and updated on your public listings.");
  }

  const checks = [{ label: "Email", complete: initial.emailVerified }, { label: "Phone", complete: initial.phoneVerified }, { label: "Identity", complete: initial.identityVerified }, { label: "Business", complete: initial.businessVerified }];
  return <div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Trust center</p><h3 className="mt-2 text-xl font-bold">Verification status</h3><div className="mt-4 grid grid-cols-2 gap-3">{checks.map((check) => <div key={check.label} className={`rounded-xl p-3 text-sm font-bold ${check.complete ? "bg-[#e4f1e5] text-[#35704a]" : "bg-white text-[#718078]"}`}>{check.complete ? "✓" : "○"} {check.label}</div>)}</div><p className="mt-4 text-xs leading-5 text-[#718078]">Email is verified through the secure link. Phone, identity, and business checks are awarded after BubsBookings admin review.</p></section><form onSubmit={save} className="rounded-2xl border border-[#183126]/10 p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Booking rules</p><h3 className="mt-2 text-xl font-bold">Cancellation and no-shows</h3><label className="mt-4 block text-sm font-bold">Notice window<select value={hours} onChange={(event) => setHours(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3">{[0, 2, 6, 12, 24, 48, 72].map((value) => <option key={value} value={value}>{value === 0 ? "Any time" : `${value} hours`}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Cancellation policy<textarea required minLength={10} maxLength={500} rows={3} value={policy} onChange={(event) => setPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">No-show policy<textarea required minLength={10} maxLength={500} rows={3} value={noShowPolicy} onChange={(event) => setNoShowPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label>{message && <p className="mt-3 text-xs font-bold text-[#35704a]">{message}</p>}{error && <p className="mt-3 text-xs font-bold text-[#964f2c]">{error}</p>}<button disabled={busy} className="mt-4 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save policies"}</button></form></div>;
}
