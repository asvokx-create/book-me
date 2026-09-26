"use client";

import { useEffect, useState } from "react";

type State = "loading" | "not_started" | "action_needed" | "in_review" | "ready" | "unavailable" | "not_available";

export default function AffiliateStripeSetup({ initialConnected, initialReady, initialTaxState, returning }: { initialConnected: boolean; initialReady: boolean; initialTaxState: string; returning: boolean }) {
  const [state, setState] = useState<State>(initialReady ? "ready" : initialConnected ? "in_review" : "not_started");
  const [taxState, setTaxState] = useState(initialTaxState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setState("loading");
    try {
      const response = await fetch("/api/affiliates/stripe/status", { cache: "no-store" });
      const result = await response.json() as { state?: State; taxState?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Stripe status could not be refreshed.");
      setState(result.state ?? "unavailable");
      if (result.taxState) setTaxState(result.taxState);
    } catch (cause) {
      setState("unavailable");
      setError(cause instanceof Error ? cause.message : "Stripe status could not be refreshed.");
    }
  }
  useEffect(() => {
    if (!returning) return;
    let active = true;
    fetch("/api/affiliates/stripe/status", { cache: "no-store" })
      .then(async response => ({ response, result: await response.json() as { state?: State; taxState?: string; error?: string } }))
      .then(({ response, result }) => {
        if (!active) return;
        if (!response.ok) throw new Error(result.error ?? "Stripe status could not be refreshed.");
        setState(result.state ?? "unavailable");
        if (result.taxState) setTaxState(result.taxState);
      })
      .catch(cause => {
        if (!active) return;
        setState("unavailable");
        setError(cause instanceof Error ? cause.message : "Stripe status could not be refreshed.");
      });
    return () => { active = false; };
  }, [returning]);
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/affiliates/stripe/connect", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Stripe setup could not be started.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Stripe setup could not be started.");
      setBusy(false);
    }
  }
  const content = state === "ready"
    ? { title: "Stripe payouts ready", body: taxState === "complete" ? "Your Stripe payout account and tax review are complete. Eligible payouts can be sent to your Stripe balance." : "Your Stripe payout account is connected. BubsBookings still needs to complete the program tax review before sending your first payout.", action: "Review Stripe setup" }
    : state === "action_needed"
      ? { title: "Stripe needs more information", body: "Finish the outstanding Stripe requirements so affiliate payouts can be sent securely.", action: "Continue Stripe setup" }
      : state === "in_review" || state === "loading"
        ? { title: "Stripe setup is being reviewed", body: "Stripe is reviewing your payout information. Refresh the status or continue setup if Stripe requests more information.", action: "Continue Stripe setup" }
        : { title: "Set up Stripe payouts", body: "Connect a U.S. Stripe payout account so BubsBookings can send approved creator earnings to your Stripe balance. BubsBookings does not receive your full bank account details.", action: "Set up Stripe payouts" };
  return <section className="mt-7 rounded-[1.75rem] border border-[#183126]/10 bg-[#eef4e9] p-5 sm:p-6" aria-labelledby="stripe-payout-heading">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#687970]">Payout account</p><h2 id="stripe-payout-heading" className="mt-1 text-2xl font-bold">{content.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f7067]">{content.body}</p></div><div className="flex shrink-0 flex-col gap-2 sm:items-end"><button type="button" disabled={busy||state==="loading"} onClick={()=>void connect()} className="min-h-12 rounded-full bg-[#183126] px-6 py-3 font-bold text-white disabled:opacity-60">{busy?"Opening Stripe…":content.action}</button>{initialConnected||state!=="not_started"?<button type="button" onClick={()=>void refresh()} disabled={state==="loading"} className="min-h-11 rounded-full border border-[#183126]/15 bg-white px-5 py-2 text-sm font-bold disabled:opacity-60">{state==="loading"?"Refreshing…":"Refresh status"}</button>:null}</div></div>
    {error?<p role="alert" className="mt-4 rounded-xl bg-[#fff0e7] p-3 text-sm font-bold text-[#9a4e25]">{error}</p>:null}
  </section>;
}
