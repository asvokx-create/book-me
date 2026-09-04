"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(""); const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/bug-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, details, steps, pageUrl: window.location.href }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null; setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not send that bug report."); return; }
    setSent(true); setTitle(""); setDetails(""); setSteps("");
  }
  return <>
    <button type="button" onClick={() => { setOpen(true); setSent(false); setError(""); }} className="rounded-lg px-2 py-1 font-semibold transition hover:bg-[#dfe7da]">Report a bug</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="bug-title"><div className="w-full max-w-lg rounded-[2rem] bg-white p-6 text-[#183126] shadow-2xl sm:p-8">{sent ? <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e5f1e5] text-2xl">✓</span><h2 id="bug-title" className="mt-4 text-2xl font-bold">Thanks for helping BookMe</h2><p className="mt-2 text-sm text-[#687970]">Your report is now in the admin bug queue.</p><button onClick={() => setOpen(false)} className="mt-6 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white">Done</button></div> : <form onSubmit={submit}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Product feedback</p><h2 id="bug-title" className="mt-2 text-2xl font-bold">Report a bug</h2><p className="mt-2 text-sm text-[#687970]">You must be logged in. Please do not include passwords or payment information.</p><label className="mt-5 block text-sm font-bold">Short title<input required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="What is broken?" /></label><label className="mt-4 block text-sm font-bold">What happened?<textarea required minLength={10} maxLength={2000} rows={4} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-2 w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label><label className="mt-4 block text-sm font-bold">Steps to recreate it <span className="font-normal text-[#718078]">(optional)</span><textarea maxLength={2000} rows={3} value={steps} onChange={(event) => setSteps(event.target.value)} className="mt-2 w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label>{error && <p className="mt-3 rounded-xl bg-[#fff0e8] px-3 py-2 text-xs font-bold text-[#964f2c]">{error}{error.includes("Log in") && <> <Link href="/login" className="underline">Log in</Link></>}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={busy} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Send report"}</button></div></form>}</div></div>}
  </>;
}
