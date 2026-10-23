"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function AffiliateAgreementReacceptance({ reason }: { reason?: string | null }) {
  const [partner, setPartner] = useState(false);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    const response = await fetch("/api/affiliates/agreements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerAgreementAccepted: partner, termsAccepted: terms, privacyAcknowledged: privacy }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setStatus("idle");
      setError(result?.error ?? "Your agreement acceptance could not be recorded.");
      return;
    }
    setStatus("done");
  }

  if (status === "done") return <section role="status" className="mt-6 rounded-2xl border border-[#34704a]/20 bg-[#edf6ed] p-5"><h2 className="font-bold">Agreement acceptance recorded</h2><p className="mt-1 text-sm leading-6 text-[#5f7067]">Your Partner records now reference the current published versions.</p></section>;

  return <form onSubmit={submit} className="mt-6 rounded-2xl border border-[#a17c16]/25 bg-[#fff8d8] p-5" aria-labelledby="partner-reaccept-heading">
    <h2 id="partner-reaccept-heading" className="text-xl font-bold">Review updated Partner documents</h2>
    <p className="mt-2 text-sm leading-6 text-[#687970]">{reason || "A current agreement version needs your affirmative acceptance. Your stored custom compensation and existing referral terms are not replaced by this acknowledgment."}</p>
    <div className="mt-4 grid gap-3">
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={partner} onChange={event => setPartner(event.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#183126]"/><span>I have read and agree to the <Link href="/partner-agreement" target="_blank" className="font-bold underline">BubsBookings Partner Agreement</Link>.</span></label>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={terms} onChange={event => setTerms(event.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#183126]"/><span>I have read and agree to the <Link href="/terms" target="_blank" className="font-bold underline">BubsBookings Terms of Service</Link>.</span></label>
      <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={privacy} onChange={event => setPrivacy(event.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#183126]"/><span>I acknowledge the <Link href="/privacy" target="_blank" className="font-bold underline">BubsBookings Privacy Policy</Link>.</span></label>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-[#fff0e7] p-3 text-sm font-bold text-[#9a4e25]">{error}</p> : null}
    <button disabled={status === "saving"} className="mt-4 min-h-11 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{status === "saving" ? "Recording acceptance…" : "Accept current versions"}</button>
  </form>;
}
