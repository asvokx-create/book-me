"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, type Dispatch, type SetStateAction } from "react";

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
};

export default function ProviderTrustSettings({ initial }: { initial: TrustSettings }) {
  const [hours, setHours] = useState(String(initial.cancellationWindowHours));
  const [policy, setPolicy] = useState(initial.cancellationPolicy);
  const [noShowPolicy, setNoShowPolicy] = useState(initial.noShowPolicy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verifyType, setVerifyType] = useState<"phone" | "identity" | "business" | null>(null);
  const [verificationDetails, setVerificationDetails] = useState<Record<string, string>>({});
  const [verificationRequests, setVerificationRequests] = useState<Record<string, { status: string; adminNote: string }>>({});

  useEffect(() => { fetch("/api/providers/verifications", { cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ requests: Record<string, { status: string; adminNote: string }> }> : null).then((data) => { if (data) setVerificationRequests(data.requests); }).catch(() => null); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const response = await fetch("/api/providers/trust-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cancellationWindowHours: Number(hours), cancellationPolicy: policy, noShowPolicy }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not save your policy."); return; }
    setMessage("Cancellation policy saved and updated on your public listings.");
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!verifyType) return; setBusy(true); setError(""); setMessage("");
    const response = await fetch("/api/providers/verifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: verifyType, details: verificationDetails }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null; setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not submit this verification."); return; }
    setVerificationRequests((current) => ({ ...current, [verifyType]: { status: "pending", adminNote: "" } })); setMessage(`${verifyType[0].toUpperCase()}${verifyType.slice(1)} verification submitted for admin review.`); setVerifyType(null); setVerificationDetails({});
  }

  const checks = [{ type: "email", label: "Email verified", complete: initial.emailVerified }, { type: "phone", label: "Phone verified", complete: initial.phoneVerified }, { type: "identity", label: "Identity verified", complete: initial.identityVerified }, { type: "business", label: "Business verified", complete: initial.businessVerified }];
  const screened = initial.screeningStatus === "passed";
  return <><div className="mt-6 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Trust center</p><h3 className="mt-2 text-xl font-bold">Safety and verification</h3><div className={`mt-4 rounded-2xl p-4 ${screened ? "bg-[#e4f1e5] text-[#2f6744]" : "bg-[#fff5cf] text-[#75651d]"}`}><div className="flex items-center justify-between gap-3"><p className="font-bold">{screened ? "✓ Automated profile screening passed" : "Automated screening not complete"}</p>{initial.screeningScore !== null && <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold">{initial.screeningScore}%</span>}</div><p className="mt-2 text-xs leading-5">{initial.screeningSummary || "Complete provider setup to run the instant business and listing safety check."}</p>{initial.screeningCheckedAt && <p className="mt-2 text-[11px] opacity-70">Checked {new Date(initial.screeningCheckedAt).toLocaleDateString()}</p>}</div><div className="mt-4 grid grid-cols-2 gap-3">{checks.map((check) => { const pending = verificationRequests[check.type]?.status === "pending"; const className = `rounded-xl p-3 text-left text-sm font-bold transition ${check.complete ? "bg-[#e4f1e5] text-[#35704a]" : pending ? "bg-[#fff3b0] text-[#75651d]" : "bg-white text-[#52685c] hover:bg-[#eee25a]"}`; return check.type === "email" ? <Link key={check.label} href="/account/security" className={className}>{check.complete ? "✓" : "○"} {check.label}<span className="mt-1 block text-[10px] font-semibold">{check.complete ? "Complete" : "Click to verify"}</span></Link> : <button type="button" disabled={check.complete || pending} key={check.label} onClick={() => { setVerifyType(check.type as "phone" | "identity" | "business"); setVerificationDetails({}); setError(""); }} className={className}>{check.complete ? "✓" : pending ? "◷" : "○"} {check.label}<span className="mt-1 block text-[10px] font-semibold">{check.complete ? "Complete" : pending ? "Admin review pending" : "Click to begin"}</span></button>; })}</div><p className="mt-4 text-xs leading-5 text-[#718078]">Automated screening checks profile completeness and professional, family-friendly content. Phone, identity, and business badges require admin review before they appear publicly.</p>{message && <p className="mt-3 text-xs font-bold text-[#35704a]">{message}</p>}</section><form onSubmit={save} className="rounded-2xl border border-[#183126]/10 p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">Booking rules</p><h3 className="mt-2 text-xl font-bold">Cancellation and no-shows</h3><label className="mt-4 block text-sm font-bold">Notice window<select value={hours} onChange={(event) => setHours(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3">{[0, 2, 6, 12, 24, 48, 72].map((value) => <option key={value} value={value}>{value === 0 ? "Any time" : `${value} hours`}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Cancellation policy<textarea required minLength={10} maxLength={500} rows={3} value={policy} onChange={(event) => setPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">No-show policy<textarea required minLength={10} maxLength={500} rows={3} value={noShowPolicy} onChange={(event) => setNoShowPolicy(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label>{error && <p className="mt-3 text-xs font-bold text-[#964f2c]">{error}</p>}<button disabled={busy} className="mt-4 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Saving…" : "Save policies"}</button></form></div>
  {verifyType && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true"><form onSubmit={submitVerification} className="w-full max-w-lg rounded-[2rem] bg-white p-6 text-[#183126] shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Trust Center</p><h2 className="mt-2 text-2xl font-bold capitalize">Verify your {verifyType}</h2><p className="mt-2 text-sm leading-6 text-[#687970]">Submit the details below for admin review. Never enter a full government ID number.</p>{verifyType === "phone" && <><TrustInput label="Phone number" name="phone_number" value={verificationDetails.phone_number ?? ""} set={setVerificationDetails} placeholder="425-555-0123" /><TrustInput label="Best time for a verification call" name="contact_time" value={verificationDetails.contact_time ?? ""} set={setVerificationDetails} placeholder="Weekdays after 3 PM" /></>}{verifyType === "identity" && <><TrustInput label="Legal name" name="legal_name" value={verificationDetails.legal_name ?? ""} set={setVerificationDetails} /><TrustInput label="Government ID type" name="document_type" value={verificationDetails.document_type ?? ""} set={setVerificationDetails} placeholder="Driver license or passport" /><TrustInput label="Last 4 characters only" name="document_last_four" value={verificationDetails.document_last_four ?? ""} set={setVerificationDetails} maxLength={4} /></>}{verifyType === "business" && <><TrustInput label="Registered business name" name="business_name" value={verificationDetails.business_name ?? ""} set={setVerificationDetails} /><TrustInput label="Registration state" name="registration_state" value={verificationDetails.registration_state ?? ""} set={setVerificationDetails} placeholder="Washington" /><TrustInput label="License or registration last 4 characters" name="registration_last_four" value={verificationDetails.registration_last_four ?? ""} set={setVerificationDetails} maxLength={4} /></>}{error && <p className="mt-4 rounded-xl bg-[#fff0e8] p-3 text-xs font-bold text-[#964f2c]">{error}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setVerifyType(null)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={busy} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit for review"}</button></div></form></div>}</>;
}

function TrustInput({ label, name, value, set, placeholder = "", maxLength = 200 }: { label: string; name: string; value: string; set: Dispatch<SetStateAction<Record<string, string>>>; placeholder?: string; maxLength?: number }) {
  return <label className="mt-4 block text-sm font-bold">{label}<input required minLength={2} maxLength={maxLength} value={value} onChange={(event) => set((current) => ({ ...current, [name]: event.target.value }))} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label>;
}
