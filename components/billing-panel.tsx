"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

type StripeStatus = {
  configured: boolean;
  mode: "test" | "live";
  hasCustomer: boolean;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  extraTeamSeats: number;
  connect: { started: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; state: "not_started" | "in_review" | "action_needed" | "ready"; requirements: string[]; disabledReason: string | null; taxReportingStatus: string | null };
};

export default function BillingPanel({ plan }: { plan: ProviderPlan }) {
  const current = PLAN_ENTITLEMENTS[plan];
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seatDraft, setSeatDraft] = useState(0);

  useEffect(() => {
    const noticeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("stripe") === "subscription-success") setNotice("Stripe received your subscription. Your plan will update after the secure webhook confirms it.");
      if (params.get("stripe") === "connect-return") setNotice("Payout details submitted. Stripe may take a moment to finish verification.");
      if (params.get("stripe") === "tax-return") setNotice("Tax information submitted. Stripe will verify it and prepare eligible year-end forms.");
      if (params.get("stripe") === "cancelled") setNotice("Checkout was cancelled. Nothing was charged.");
    }, 0);
    fetch("/api/stripe/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<StripeStatus> : null)
      .then((data) => { setStatus(data); setSeatDraft(data?.extraTeamSeats ?? 0); })
      .catch(() => setError("We could not load Stripe status."));
    return () => window.clearTimeout(noticeTimer);
  }, []);

  async function openStripe(path: string, body?: Record<string, string>) {
    setWorking(path);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(path, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: controller.signal }).catch(() => null);
    window.clearTimeout(timeout);
    const result = response ? await response.json() as { url?: string; error?: string } : null;
    if (!response?.ok || !result?.url) {
      setError(result?.error ?? "Stripe took too long to respond. Please try again.");
      setWorking("");
      return;
    }
    window.location.assign(result.url);
  }

  async function updateTeamSeats() {
    setWorking("team-seats"); setError(""); setNotice("");
    const response = await fetch("/api/stripe/team-seats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraSeats: seatDraft }) }).catch(() => null);
    const result = response ? await response.json() as { extraTeamSeats?: number; error?: string } : null;
    setWorking("");
    if (!response?.ok || result?.extraTeamSeats === undefined) { setError(result?.error ?? "We could not update your employee seats."); return; }
    setStatus((currentStatus) => currentStatus ? { ...currentStatus, extraTeamSeats: result.extraTeamSeats! } : currentStatus);
    setSeatDraft(result.extraTeamSeats);
    setNotice(`Your Pro plan now includes ${3 + result.extraTeamSeats} total team seats.`);
  }

  const payoutReady = status?.connect.chargesEnabled && status.connect.payoutsEnabled;
  const taxReportingReady = status?.connect.taxReportingStatus === "active";
  const hasSubscription = status?.subscriptionStatus === "active" || status?.subscriptionStatus === "trialing";
  const isOwner = plan === "owner";

  return <div>
    <div><div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-[#687a70]">Company subscription</p>{status && <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.mode === "live" ? "bg-[#e6f2e6] text-[#34704a]" : "bg-[#fff3c4] text-[#775f00]"}`}>{status.mode === "live" ? "Live payments" : "Test mode"}</span>}</div><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Billing & payouts</h1><p className="mt-2 text-sm text-[#687a70]">Manage your provider plan, customer payments, and Stripe payouts.</p></div>
    {notice && <p role="status" className="mt-5 rounded-2xl bg-[#e6f2e6] px-5 py-4 text-sm font-bold text-[#34704a]">{notice}</p>}
    {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0e8] px-5 py-4 text-sm font-bold text-[#964f2c]">{error}</p>}
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-[2rem] bg-[#183126] p-7 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4c5bc]">Current plan</p><h2 className="mt-2 text-3xl font-bold">{current.name}</h2></div><span className="rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold text-[#183126]">{isOwner ? "Private" : "Active"}</span></div><p className="mt-7 text-4xl font-bold">${(current.monthlyPrice + (plan === "pro" ? (status?.extraTeamSeats ?? 0) * 0.5 : 0)).toFixed(2)}<span className="text-sm font-normal text-[#b7c7be]"> / month</span></p>{plan === "pro" && Boolean(status?.extraTeamSeats) && <p className="mt-1 text-xs text-[#b7c7be]">$9.99 Pro + ${((status?.extraTeamSeats ?? 0) * 0.5).toFixed(2)} employee seats</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><BillingFact label="Booking fee" value={`${current.bookingFeePercent}%`} /><BillingFact label="Services" value={current.serviceLimit === null ? "Unlimited" : `Up to ${current.serviceLimit}`} /><BillingFact label="Team seats" value={current.teamSeatLimit === null ? "Unlimited" : String(current.teamSeatLimit + (plan === "pro" ? status?.extraTeamSeats ?? 0 : 0))} /><BillingFact label="Features" value={isOwner ? "All unlocked" : current.advancedAnalytics ? "Advanced" : "Essentials"} /></div><div className="mt-7 flex flex-wrap gap-2">{isOwner ? <span className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold">Only your owner account can use this plan</span> : hasSubscription ? <button disabled={Boolean(working)} onClick={() => void openStripe("/api/stripe/customer-portal")} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#eee25a] disabled:opacity-50">Manage subscription</button> : <button disabled={Boolean(working) || !status?.configured} onClick={() => void openStripe("/api/stripe/subscriptions/checkout", { plan: "pro" })} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] hover:bg-[#f5ea6b] disabled:opacity-50">Choose Pro for $9.99</button>}<Link href="/pricing" className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10">Compare plans</Link></div></section>
      <section className={`rounded-[2rem] border p-7 ${payoutReady ? "border-[#8cb795] bg-[#e9f4e8]" : "border-[#d8cb63] bg-[#fff9d9]"}`}><span className="text-3xl">{payoutReady ? "✓" : "💳"}</span><h2 className="mt-4 text-xl font-bold">{payoutReady ? "Payouts are ready" : status?.connect.state === "in_review" ? "Stripe is reviewing your details" : status?.connect.state === "action_needed" ? "Payout setup needs attention" : "Connect provider payouts"}</h2><p className="mt-2 text-sm leading-6 text-[#706942]">{payoutReady ? "Customers can pay confirmed bookings securely. Stripe sends the provider share to your connected payout account." : status?.connect.state === "in_review" ? "Your information was submitted. Stripe will enable booking payments after verification finishes." : "Complete Stripe’s secure identity and bank setup before customers can pay for your confirmed bookings."}</p>{status?.connect.requirements.length ? <div className="mt-4 rounded-2xl bg-white/70 p-4"><p className="text-xs font-bold uppercase tracking-wider">Still needed</p><ul className="mt-2 space-y-1 text-xs text-[#706942]">{status.connect.requirements.slice(0, 5).map((item) => <li key={item}>• {item.replaceAll("_", " ").replaceAll(".", " › ")}</li>)}</ul></div> : null}<button disabled={Boolean(working) || status?.configured === false} onClick={() => void openStripe("/api/stripe/connect")} aria-busy={working === "/api/stripe/connect"} className="mt-5 min-w-40 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:cursor-wait disabled:opacity-60">{working === "/api/stripe/connect" ? "Opening Stripe…" : payoutReady ? "Review payout account" : status?.connect.started ? "Continue payout setup" : "Set up payouts"}</button>{working === "/api/stripe/connect" && <p role="status" className="mt-3 text-xs font-semibold text-[#706942]">Creating a secure Stripe connection. This normally takes a few seconds.</p>}{!status && !error && <p className="mt-3 text-xs text-[#706942]">Checking payment status… You can still begin payout setup.</p>}{!status?.configured && status && <p className="mt-4 rounded-2xl bg-white/70 p-4 text-xs font-semibold leading-5 text-[#776f45]">Stripe is installed in the app, but the administrator still needs to add the Stripe API key and webhook secret.</p>}</section>
    </div>
    {plan === "pro" && hasSubscription && <TeamSeatAddon currentExtraSeats={status?.extraTeamSeats ?? 0} seatDraft={seatDraft} working={working === "team-seats"} onChange={setSeatDraft} onSave={() => void updateTeamSeats()} />}
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">How payments work</h2><p className="mt-1 text-sm text-[#738179]">Clear separation between your subscription and customer booking money.</p></div><span className="rounded-full bg-[#edf2e8] px-3 py-1.5 text-xs font-bold">Powered by Stripe</span></div><div className="mt-6 grid gap-4 md:grid-cols-3"><Step number="1" title="Confirm the booking" body="Approve the customer’s request and any custom quote first." /><Step number="2" title="Customer pays" body="The customer uses Stripe Checkout from their booking page." /><Step number="3" title="Stripe pays you" body={`BubsBookings keeps the ${current.bookingFeePercent}% plan fee and Stripe sends your share to your payout account.`} /></div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Tax center</p><span className={`rounded-full px-3 py-1 text-[11px] font-bold ${taxReportingReady ? "bg-[#e5f1e5] text-[#34704a]" : "bg-[#fff3c4] text-[#775f00]"}`}>{taxReportingReady ? "Tax details ready" : "Setup required"}</span></div><h2 className="mt-2 text-xl font-bold">Year-end 1099 documents</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#687970]">Stripe collects the required tax information and prepares forms for eligible US providers after the tax year ends. When a form is available, you can securely view and download it from Stripe.</p></div><button disabled={Boolean(working) || !status?.connect.started} onClick={() => void openStripe("/api/stripe/tax-documents", { action: taxReportingReady ? "dashboard" : "setup" })} className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:opacity-50">{working === "/api/stripe/tax-documents" ? "Opening Stripe…" : taxReportingReady ? "Open tax documents" : "Complete tax setup"}</button></div><div className="mt-5 rounded-2xl bg-[#f5f5ef] p-4 text-xs leading-5 text-[#718078]"><strong className="text-[#183126]">Important:</strong> A form is issued only when required under the applicable tax rules and BubsBookings&apos; configured Stripe filing settings. Providers remain responsible for their own records and taxes. This is not tax advice.</div></section>
  </div>;
}

function BillingFact({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-[#b8c7bf]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Step({ number, title, body }: { number: string; title: string; body: string }) { return <div className="rounded-2xl bg-[#f5f5ef] p-5"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#eee25a] text-xs font-bold">{number}</span><p className="mt-4 font-bold">{title}</p><p className="mt-2 text-xs leading-5 text-[#718078]">{body}</p></div>; }

function TeamSeatAddon({ currentExtraSeats, seatDraft, working, onChange, onSave }: { currentExtraSeats: number; seatDraft: number; working: boolean; onChange: (value: number) => void; onSave: () => void }) {
  return <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-7"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Team add-on</p><span className="rounded-full bg-[#e7f1e3] px-3 py-1 text-[11px] font-bold text-[#34704a]">3 seats included</span></div><h2 className="mt-2 text-xl font-bold">Extra employee seats</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#687970]">Add employees beyond the two workers included with Pro for $0.50 per employee each month. You remain the third included seat as the owner.</p></div><div className="flex flex-col gap-3 rounded-2xl bg-[#f5f5ef] p-4 sm:min-w-[340px]"><div className="flex items-center justify-between gap-4"><button type="button" onClick={() => onChange(Math.max(0, seatDraft - 1))} disabled={seatDraft === 0 || working} aria-label="Remove one extra employee seat" className="grid h-11 w-11 place-items-center rounded-full border border-[#183126]/15 bg-white text-xl font-bold disabled:opacity-40">−</button><div className="text-center"><p className="text-2xl font-bold">{seatDraft}</p><p className="text-xs text-[#718078]">extra {seatDraft === 1 ? "employee" : "employees"}</p></div><button type="button" onClick={() => onChange(Math.min(97, seatDraft + 1))} disabled={seatDraft === 97 || working} aria-label="Add one extra employee seat" className="grid h-11 w-11 place-items-center rounded-full bg-[#183126] text-xl font-bold text-white disabled:opacity-40">+</button></div><div className="flex items-center justify-between border-t border-[#183126]/10 pt-3 text-sm"><span className="text-[#687970]">Monthly add-on</span><strong>${(seatDraft * 0.5).toFixed(2)}</strong></div><button disabled={working || seatDraft === currentExtraSeats} onClick={onSave} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold disabled:opacity-50">{working ? "Updating Stripe…" : "Save employee seats"}</button></div></div><p className="mt-4 text-xs leading-5 text-[#718078]">Stripe prorates seat changes for the current billing period and applies the adjustment to your subscription billing.</p></section>;
}
