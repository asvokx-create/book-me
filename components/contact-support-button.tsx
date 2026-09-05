"use client";

import { FormEvent, useState } from "react";

export default function ContactSupportButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message }) }).catch(() => null);
    const data = response ? await response.json() as { error?: string } : null;
    setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "We could not send your message."); return; }
    setSent(true); setSubject(""); setMessage("");
  }

  return <>
    <button type="button" onClick={() => { setOpen(true); setSent(false); setError(""); }} className={className}>Contact support</button>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#10251c]/55 p-5" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 text-[#183126] shadow-2xl sm:p-8">
        {sent ? <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#e5f1e5] text-2xl">✓</span><h2 id="support-title" className="mt-4 text-2xl font-bold">Message sent to support</h2><p className="mt-2 text-sm text-[#687970]">Your request is now in the BubsBookings admin support inbox.</p><button onClick={() => setOpen(false)} className="mt-6 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white">Done</button></div> :
          <form onSubmit={submit}><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">BubsBookings support</p><h2 id="support-title" className="mt-2 text-2xl font-bold">How can we help?</h2><p className="mt-2 text-sm text-[#687970]">Send a message directly to the admin team. Do not include passwords or payment-card information.</p><label className="mt-5 block text-sm font-bold">Subject<input required minLength={4} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" placeholder="What do you need help with?" /></label><label className="mt-4 block text-sm font-bold">Message<textarea required minLength={10} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 w-full resize-none rounded-2xl border border-[#183126]/15 bg-[#fafaf6] px-4 py-3" /></label>{error && <p className="mt-3 rounded-xl bg-[#fff0e8] px-3 py-2 text-xs font-bold text-[#964f2c]">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-full px-5 py-3 text-sm font-bold hover:bg-[#edf1ec]">Cancel</button><button disabled={busy} className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Send to support"}</button></div></form>}
      </div>
    </div>}
  </>;
}
