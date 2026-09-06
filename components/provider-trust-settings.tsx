"use client";

import Link from "next/link";
import RadiusSelector from "@/components/radius-selector";
import { FormEvent, useState } from "react";

type TrustSettings = {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  businessVerified: boolean;
  screeningStatus: "not_screened" | "passed" | "needs_changes";
  screeningScore: number | null;
  screeningSummary: string;
  screeningCheckedAt: string | null;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  noShowPolicy: string;
  serviceRadiusMiles: number;
};

export default function ProviderTrustSettings({ initial }: { initial: TrustSettings }) {
  const [hours, setHours] = useState(String(initial.cancellationWindowHours));
  const [policy, setPolicy] = useState(initial.cancellationPolicy);
  const [noShowPolicy, setNoShowPolicy] = useState(initial.noShowPolicy);
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState(String(initial.serviceRadiusMiles));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [automaticChecks, setAutomaticChecks] = useState([
    { key: "account", label: "Account verified", passed: initial.emailVerified, detail: "Email and required account agreements are checked automatically." },
    { key: "phone", label: "Phone details checked", passed: initial.phoneVerified, detail: "Checks that the account and provider profile have the same validly formatted number." },
    { key: "identity", label: "Stripe identity verified", passed: initial.identityVerified, detail: "Becomes complete after Stripe accepts the required payout-onboarding details." },
    { key: "business", label: "Business profile checked", passed: initial.businessVerified, detail: "Checks business details and every active listing for completeness and safety." },
  ]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const response = await fetch("/api/providers/trust-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationWindowHours: Number(hours), cancellationPolicy: policy, noShowPolicy, serviceRadiusMiles: Number(serviceRadiusMiles) }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not save your policy."); return; }
    setMessage("Working radius and booking policies saved.");
  }

  async function runAutomaticVerification() {
    setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/providers/verifications/automatic", { method: "POST" }).catch(() => null);
    const data = response ? await response.json() as { error?: string; result?: { overall: string; score: number; checks: Array<{ key: string; label: string; passed: boolean; detail: string }> } } : null;
    setBusy(false);
    if (!response?.ok || !data?.result) { setError(data?.error ?? "The automatic verification check could not finish."); return; }
    setAutomaticChecks(data.result.checks);
    setMessage(data.result.overall === "passed" ? "All available automatic checks passed." : `Automatic check complete: ${data.result.score}%. Open the incomplete items for the next step.`);
  }

  const screened = initial.screeningStatus === "passed";
  return <div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Trust center</p><h3 className="mt-2 text-xl font-bold">Automatic safety and verification</h3><div className={`mt-4 rounded-2xl p-4 ${screened ? "bg-[#e4f1e5] text-[#2f6744]" : "bg-[#fff5cf] text-[#75651d]"}`}><div className="flex items-center justify-between gap-3"><p className="font-bold">{screened ? "✓ Automated checks passed" : "Some checks need attention"}</p>{initial.screeningScore !== null && <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{initial.screeningScore}%</span>}</div><p className="mt-2 text-xs leading-5">{initial.screeningSummary || "Run the automatic check after completing your profile and Stripe payout setup."}</p>{initial.screeningCheckedAt && <p className="mt-2 text-[11px] opacity-70">Checked {new Date(initial.screeningCheckedAt).toLocaleDateString()}</p>}</div><div className="mt-4 grid grid-cols-2 gap-3">{automaticChecks.map((check) => { const className = `rounded-xl p-3 text-left text-sm font-bold ${check.passed ? "bg-[#e4f1e5] text-[#35704a]" : "bg-white text-[#52685c]"}`; const content = <>{check.passed ? "✓" : "○"} {check.label}<span className="mt-1 block text-[10px] font-semibold leading-4">{check.detail}</span></>; return check.key === "account" && !check.passed ? <Link key={check.key} href="/account/security" className={`${className} transition hover:bg-[#eee25a]`}>{content}</Link> : check.key === "identity" && !check.passed ? <Link key={check.key} href="/provider/dashboard/billing" className={`${className} transition hover:bg-[#eee25a]`}>{content}</Link> : <div key={check.key} className={className}>{content}</div>; })}</div><p className="mt-4 text-xs leading-5 text-[#718078]">Phone checking confirms format and profile consistency, not possession of the phone. Identity status comes from Stripe; BubsBookings never approves an ID from typed text alone.</p><button type="button" disabled={busy} onClick={() => void runAutomaticVerification()} className="mt-4 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{busy ? "Checking…" : "Run automatic checks"}</button>{message && <p className="mt-3 text-xs font-bold text-[#35704a]">{message}</p>}{error && <p className="mt-3 text-xs font-bold text-[#964f2c]">{error}</p>}</section><form onSubmit={save} className="rounded-2xl border border-[#183126]/10 p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Service area and booking rules</p><h3 className="mt-2 text-xl font-bold">Where and how you work</h3><label className="mt-4 block text-sm font-bold">Working radius<span className="mt-2 block"><RadiusSelector value={Number(serviceRadiusMiles)} onChange={(value) => setServiceRadiusMiles(String(value))} /></span><span className="mt-2 block text-xs font-normal leading-5 text-[#718078]">Choose a common distance or enter a custom whole number from 1 to 250 miles. Customers outside this distance will not see your services in local results.</span></label><label className="mt-4 block text-sm font-bold">Cancellation notice window<select value={hours} onChange={(event) => setHours(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3">{[0, 2, 6, 12, 24, 48, 72].map((value) => <option key={value} value={value}>{value === 0 ? "Any time" : `${value} hours`}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Cancellation policy<textarea required minLength={10} maxLength={500} rows={3} value={policy} onChange={(event) => setPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">No-show policy<textarea required minLength={10} maxLength={500} rows={3} value={noShowPolicy} onChange={(event) => setNoShowPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><button disabled={busy} className="mt-4 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save radius and policies"}</button></form></div>;
}
