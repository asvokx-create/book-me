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
  connect: { started: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };
};

export default function BillingPanel({ plan }: { plan: ProviderPlan }) {
  const current = PLAN_ENTITLEMENTS[plan];
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const noticeTimer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("stripe") === "subscription-success") setNotice("Stripe received your subscription. Your plan will update after the secure webhook confirms it.");
      if (params.get("stripe") === "connect-return") setNotice("Payout details submitted. Stripe may take a moment to finish verification.");
      if (params.get("stripe") === "cancelled") setNotice("Checkout was cancelled. Nothing was charged.");
    }, 0);
    fetch("/api/stripe/status", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<StripeStatus> : null)
      .then((data) => setStatus(data))
      .catch(() => setError("We could not load Stripe status."));
    return () => window.clearTimeout(noticeTimer);
  }, []);

  async function openStripe(path: string, body?: Record<string, string>) {
    setWorking(path);
    setError("");
    const response = await fetch(path, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const result = response ? await response.json() as { url?: string; error?: string } : null;
    if (!response?.ok || !result?.url) {
      setError(result?.error ?? "We could not open Stripe. Please try again.");
      setWorking("");
      return;
    }
    window.location.assign(result.url);
  }

  const payoutReady = status?.connect.chargesEnabled && status.connect.payoutsEnabled;
  const hasSubscription = status?.subscriptionStatus === "active" || status?.subscriptionStatus === "trialing";
  const isOwner = plan === "owner";

  return <div>
    <div><div className="flex flex-wrap items-center gap-3"><p className="text-sm font-semibold text-[#687a70]">Company subscription</p>{status && <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.mode === "live" ? "bg-[#e6f2e6] text-[#34704a]" : "bg-[#fff3c4] text-[#775f00]"}`}>{status.mode === "live" ? "Live payments" : "Test mode"}</span>}</div><h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Billing & payouts</h1><p className="mt-2 text-sm text-[#687a70]">Manage your provider plan, customer payments, and Stripe payouts.</p></div>
    {notice && <p role="status" className="mt-5 rounded-2xl bg-[#e6f2e6] px-5 py-4 text-sm font-bold text-[#34704a]">{notice}</p>}
    {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0e8] px-5 py-4 text-sm font-bold text-[#964f2c]">{error}</p>}
    <div className="mt-7 grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-[2rem] bg-[#183126] p-7 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4c5bc]">Current plan</p><h2 className="mt-2 text-3xl font-bold">{current.name}</h2></div><span className="rounded-full bg-[#eee25a] px-4 py-2 text-xs font-bold text-[#183126]">{isOwner ? "Private" : "Active"}</span></div><p className="mt-7 text-4xl font-bold">${current.monthlyPrice.toFixed(2)}<span className="text-sm font-normal text-[#b7c7be]"> / month</span></p><div className="mt-6 grid gap-3 sm:grid-cols-2"><BillingFact label="Booking fee" value={`${current.bookingFeePercent}%`} /><BillingFact label="Services" value={current.serviceLimit === null ? "Unlimited" : `Up to ${current.serviceLimit}`} /><BillingFact label="Team seats" value={current.teamSeatLimit === null ? "Unlimited" : String(current.teamSeatLimit)} /><BillingFact label="Features" value={isOwner ? "All unlocked" : current.advancedAnalytics ? "Advanced" : "Essentials"} /></div><div className="mt-7 flex flex-wrap gap-2">{isOwner ? <span className="rounded-full bg-white/10 px-5 py-3 text-sm font-bold">Only your owner account can use this plan</span> : hasSubscription ? <button disabled={Boolean(working)} onClick={() => void openStripe("/api/stripe/customer-portal")} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#eee25a] disabled:opacity-50">Manage subscription</button> : <><button disabled={Boolean(working) || !status?.configured} onClick={() => void openStripe("/api/stripe/subscriptions/checkout", { plan: "pro" })} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] hover:bg-[#f5ea6b] disabled:opacity-50">Choose Pro</button><button disabled={Boolean(working) || !status?.configured} onClick={() => void openStripe("/api/stripe/subscriptions/checkout", { plan: "business" })} className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50">Choose Business</button></>}<Link href="/pricing" className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold hover:bg-white/10">Compare plans</Link></div></section>
      <section className={`rounded-[2rem] border p-7 ${payoutReady ? "border-[#8cb795] bg-[#e9f4e8]" : "border-[#d8cb63] bg-[#fff9d9]"}`}><span className="text-3xl">{payoutReady ? "✓" : "💳"}</span><h2 className="mt-4 text-xl font-bold">{payoutReady ? "Payouts are ready" : "Connect provider payouts"}</h2><p className="mt-2 text-sm leading-6 text-[#706942]">{payoutReady ? "Customers can pay confirmed bookings securely. Stripe sends the provider share to your connected payout account." : "Complete Stripe’s secure identity and bank setup before customers can pay for your confirmed bookings."}</p><button disabled={Boolean(working) || !status?.configured} onClick={() => void openStripe("/api/stripe/connect")} className="mt-5 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white hover:bg-[#315846] disabled:opacity-50">{payoutReady ? "Review payout account" : status?.connect.started ? "Continue payout setup" : "Set up payouts"}</button>{!status?.configured && status && <p className="mt-4 rounded-2xl bg-white/70 p-4 text-xs font-semibold leading-5 text-[#776f45]">Stripe is installed in the app, but the administrator still needs to add the Stripe key, plan price IDs, and webhook secret.</p>}</section>
    </div>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">How payments work</h2><p className="mt-1 text-sm text-[#738179]">Clear separation between your subscription and customer booking money.</p></div><span className="rounded-full bg-[#edf2e8] px-3 py-1.5 text-xs font-bold">Powered by Stripe</span></div><div className="mt-6 grid gap-4 md:grid-cols-3"><Step number="1" title="Confirm the booking" body="Approve the customer’s request and any custom quote first." /><Step number="2" title="Customer pays" body="The customer uses Stripe Checkout from their booking page." /><Step number="3" title="Stripe pays you" body={`BubsBookings keeps the ${current.bookingFeePercent}% plan fee and Stripe sends your share to your payout account.`} /></div></section>
  </div>;
}

function BillingFact({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-[#b8c7bf]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Step({ number, title, body }: { number: string; title: string; body: string }) { return <div className="rounded-2xl bg-[#f5f5ef] p-5"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#eee25a] text-xs font-bold">{number}</span><p className="mt-4 font-bold">{title}</p><p className="mt-2 text-xs leading-5 text-[#718078]">{body}</p></div>; }
