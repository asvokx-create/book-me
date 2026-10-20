"use client";

import { useEffect, useState } from "react";
import { providerPayoutReminderCopy, type ProviderPayoutSetupState } from "@/lib/provider-payout-status";

type StripeStatus = {
  configured: boolean;
  connect: { state: ProviderPayoutSetupState };
};

export default function ProviderPayoutReminder() {
  const [state, setState] = useState<ProviderPayoutSetupState | "loading" | "unavailable">("loading");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  async function refresh() {
    const response = await fetch("/api/stripe/status", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setState("unavailable");
      return;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      setState("unavailable");
      return;
    }
    const data = await response.json() as StripeStatus;
    setConfigured(data.configured);
    setState(data.connect.state);
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(interval); };
  }, []);

  async function openStripe() {
    setOpening(true);
    setError("");
    const response = await fetch("/api/stripe/connect", { method: "POST" }).catch(() => null);
    const contentType = response?.headers.get("content-type") ?? "";
    const result = response && contentType.includes("application/json")
      ? await response.json().catch(() => null) as { url?: string; error?: string } | null
      : null;
    if (!response?.ok || !result?.url) {
      setError(result?.error ?? "We could not open Stripe right now. Please try again.");
      setOpening(false);
      return;
    }
    window.location.assign(result.url);
  }

  if (state === "loading" || state === "ready") return null;
  const message = state === "unavailable"
    ? "We could not confirm your payout status. Open Stripe setup to make sure your account is ready to receive payouts."
    : providerPayoutReminderCopy(state);

  return <section aria-labelledby="provider-payout-reminder-title" className="mb-6 rounded-[1.75rem] border border-[#d8cb63] bg-[#fff9d9] p-5 shadow-[0_8px_25px_rgba(92,78,18,.06)] sm:p-6">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#74691d]">Payout reminder</p><h2 id="provider-payout-reminder-title" className="mt-1 text-xl font-bold">Complete Your Payout Setup</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#706942]">{message}</p><p className="mt-1 text-sm leading-6 text-[#706942]">Connect your Stripe account to receive payments from your bookings. Your payout setup isn’t complete yet.</p></div>
      <button type="button" onClick={() => void openStripe()} disabled={opening || !configured} className="min-h-12 shrink-0 rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846] disabled:cursor-wait disabled:opacity-60">{opening ? "Opening Stripe…" : "Set Up Stripe Payouts"}</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff0e8] px-4 py-3 text-sm font-semibold text-[#964f2c]">{error}</p>}
    {!configured && <p role="alert" className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-[#776f45]">Stripe payout setup is temporarily unavailable. Please try again later.</p>}
  </section>;
}
