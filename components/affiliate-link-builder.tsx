"use client";

import { useMemo, useState } from "react";
import QRCode from "react-qr-code";

const destinations = [
  ["Homepage", "/"], ["Provider signup", "/providers/join"], ["Provider pricing", "/pricing"], ["Partner program", "/partners"],
] as const;

export default function AffiliateLinkBuilder({ code }: { code: string }) {
  const [destination, setDestination] = useState("/providers/join");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);
  const link = useMemo(() => {
    const url = new URL(destination, "https://bubsbookings.com");
    url.searchParams.set("ref", code);
    url.searchParams.set("utm_source", "affiliate");
    if (campaign.trim()) url.searchParams.set("utm_campaign", campaign.trim().slice(0, 80));
    return url.toString();
  }, [code, destination, campaign]);
  async function copy() { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  return <section className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 sm:p-6">
    <h2 className="text-xl font-bold">Referral link builder</h2><p className="mt-1 text-sm text-[#687970]">Create links only to approved BubsBookings pages. Eligible visits use the same first-party attribution system.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Destination<select value={destination} onChange={(event) => setDestination(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 bg-white px-3 py-3 text-base">{destinations.map(([label, path]) => <option key={path} value={path}>{label}</option>)}</select></label><label className="text-sm font-bold">Campaign <span className="font-normal text-[#718078]">(optional)</span><input value={campaign} onChange={(event) => setCampaign(event.target.value)} className="mt-2 w-full rounded-xl border border-[#183126]/15 px-3 py-3 text-base" placeholder="spring-video" /></label></div>
    <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-2xl bg-[#f5f6f1] p-4 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs">{link}</code><button type="button" onClick={() => void copy()} className="min-h-11 shrink-0 rounded-full bg-[#eee25a] px-5 text-sm font-bold">{copied ? "Copied" : "Copy link"}</button><span className="sr-only" aria-live="polite">{copied ? "Referral link copied" : ""}</span></div>
    <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Show QR code</summary><div className="mt-4 w-fit rounded-2xl border border-[#183126]/10 bg-white p-4"><QRCode value={link} size={152} aria-label="QR code for referral link" /></div></details>
  </section>;
}
