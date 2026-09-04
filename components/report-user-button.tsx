"use client";

import { FormEvent, useState } from "react";

export default function ReportUserButton({ bookingId, targetLabel }: { bookingId: string; targetLabel: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/safety-reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, category, details }),
    }).catch(() => null);
    const result = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setError(result?.error ?? "We could not submit your report."); return; }
    setOpen(false); setDetails(""); setNotice("Report submitted for admin review.");
  }

  return <>
    {notice ? <p className="rounded-2xl bg-[#e5f1e5] px-4 py-3 text-center text-xs font-bold text-[#34704a]">✓ {notice}</p> : <button type="button" onClick={() => setOpen(true)} className="rounded-full px-5 py-3 text-sm font-bold text-[#8a4c3a] transition hover:bg-[#f4d8cc]">⚑ Report {targetLabel}</button>}
    {open && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="booking-report-title"><form onSubmit={submit} className="w-full max-w-lg rounded-[2rem] bg-white p-6 text-[#183126] shadow-2xl sm:p-8"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Trust and safety</p><h2 id="booking-report-title" className="mt-2 text-2xl font-bold">Report {targetLabel}</h2><p className="mt-2 text-sm leading-6 text-[#687970]">An admin will review this report. The other person will not be told who submitted it.</p><label className="mt-5 block text-sm font-bold">Reason<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3"><option value="harassment">Harassment or abusive behavior</option><option value="spam">Spam or scam</option><option value="unsafe">Threat or unsafe situation</option><option value="other">Something else</option></select></label><label className="mt-5 block text-sm font-bold">What happened?<textarea required minLength={10} maxLength={1000} rows={5} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-2 w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3 outline-none" placeholder="Give a clear reason for this report." /></label>{error && <p className="mt-3 rounded-xl bg-[#fff0e8] px-3 py-2 text-xs font-bold text-[#964f2c]">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={busy} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Submit report"}</button></div></form></div>}
  </>;
}
