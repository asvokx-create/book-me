"use client";

import { useState } from "react";
import CustomSelect from "@/components/custom-select";
import { complimentaryProExpiration, type ComplimentaryProDuration } from "@/lib/complimentary-pro-policy";

type Status = { active: boolean; startsAt: string | null; expiresAt: string | null; lifetime: boolean; reason: string | null };
type History = { id: string; action: string; reason: string | null; previous_expires_at: string | null; new_expires_at: string | null; created_at: string; actor_name: string };

export default function AdminComplimentaryPro({ providerId, status, history, paidBillingConflict, onChanged }: { providerId: string; status: Status; history: History[]; paidBillingConflict: boolean; onChanged: () => Promise<void> }) {
  const [duration, setDuration] = useState<ComplimentaryProDuration>("30_days");
  const [customDays, setCustomDays] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function change(action: "grant" | "revoke") {
    const description = action === "revoke" ? "revoke this provider's complimentary Pro access" : `${status.active ? "extend" : "grant"} complimentary Pro access`;
    const expirationConfirmation = action === "grant" ? ` Expected expiration: ${previewExpiry}.` : "";
    if (!window.confirm(`Confirm that you want to ${description}.${expirationConfirmation} Stripe billing will not be changed.`)) return;
    setBusy(true); setMessage(""); setFailed(false);
    const response = await fetch(`/api/admin/providers/${encodeURIComponent(providerId)}/complimentary-pro`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, duration, customDays: duration === "custom" ? customDays : undefined, reason }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => null) as { error?: string } | null : null;
    if (!response?.ok) { setFailed(true); setMessage(result?.error ?? "The change could not be saved."); }
    else { setMessage(action === "revoke" ? "Complimentary Pro access revoked." : status.active ? "Complimentary Pro access extended." : "Complimentary Pro access granted."); setReason(""); await onChanged(); }
    setBusy(false);
  }

  const expiry = status.lifetime ? "Lifetime" : status.expiresAt ? new Date(status.expiresAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "Not active";
  const previewBase = status.active && status.expiresAt ? new Date(status.expiresAt) : new Date();
  const previewDate = complimentaryProExpiration({ duration, startsAt: previewBase, customDays: duration === "custom" ? customDays : undefined });
  const previewExpiry = previewDate ? previewDate.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "Lifetime";
  return <section className="rounded-2xl border border-[#8cb795] bg-[#edf5e9] p-4">
    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#52665b]">Grant Free Pro</p>
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{status.active ? "Complimentary Pro is active" : "No active complimentary grant"}</h4>{status.active && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#34704a]">{expiry}</span>}</div>
    <p className="mt-2 text-sm leading-6 text-[#52665b]">Grants include the full Pro plan at no subscription charge. Paid Stripe subscriptions are never canceled, paused, refunded, or changed by this control.</p>
    {paidBillingConflict && <p role="alert" className="mt-3 rounded-xl border border-[#9a4e25]/25 bg-[#fff0e7] p-3 text-sm font-bold text-[#7b3c1b]">This provider has an existing or pending paid Pro subscription. Complimentary access is blocked so normal Stripe billing cannot overlap with a free grant.</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]">
      <label className="text-sm font-bold">Duration<CustomSelect ariaLabel="Complimentary Pro duration" value={duration} onChange={(value) => setDuration(value as ComplimentaryProDuration)} buttonClassName="mt-1 min-h-11 w-full rounded-xl border border-[#183126]/15 bg-white px-3"><option value="30_days">30 days</option><option value="2_months">2 calendar months</option><option value="3_months">3 months</option><option value="6_months">6 months</option><option value="1_year">1 year</option><option value="lifetime">Lifetime</option><option value="custom">Custom</option></CustomSelect></label>
      {duration === "custom" && <label className="text-sm font-bold">Days<input type="number" min={1} max={3650} value={customDays} onChange={(event) => setCustomDays(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-[#183126]/15 bg-white px-3" /></label>}
    </div>
    <p className="mt-2 text-xs font-semibold text-[#52665b]">Expected expiration: {previewExpiry}. The server records the final UTC timestamp when you confirm.</p>
    <label className="mt-3 block text-sm font-bold">Internal reason (optional)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full resize-y rounded-xl border border-[#183126]/15 bg-white px-3 py-2" /></label>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || paidBillingConflict} onClick={() => void change("grant")} className="rounded-full bg-[#183126] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? "Saving..." : status.active ? "Extend Free Pro" : "Grant Free Pro"}</button>{status.active && <button type="button" disabled={busy} onClick={() => void change("revoke")} className="rounded-full bg-[#9a4e25] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Revoke grant</button>}</div>
    {message && <p role={failed ? "alert" : "status"} className={`mt-3 text-sm font-bold ${failed ? "text-[#9a4e25]" : "text-[#34704a]"}`}>{message}</p>}
    <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Grant history ({history.length})</summary><div className="mt-2 space-y-2">{history.length ? history.map((event) => <div key={event.id} className="rounded-xl bg-white/80 p-3 text-xs"><p className="font-bold">{event.action.replaceAll("_", " ")} by {event.actor_name}</p><p className="mt-1 text-[#718078]">{new Date(event.created_at).toLocaleString()}</p>{event.new_expires_at && <p className="mt-1">New expiration: {new Date(event.new_expires_at).toLocaleString()}</p>}{event.reason && <p className="mt-1">Reason: {event.reason}</p>}</div>) : <p className="text-xs text-[#718078]">No grant history yet.</p>}</div></details>
  </section>;
}
