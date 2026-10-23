"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { payoutActivationStep, type ActivationStepStatus, type ProviderAgeVerificationStatus } from "@/lib/provider-activation";
import type { ProviderPayoutSetupState } from "@/lib/provider-payout-status";

type LocalStep = { status: ActivationStepStatus; detail: string };
type ActivationListing = { id: string; title: string; publiclyAvailable: boolean; reasons: string[]; lastStatusUpdate: string };
export type ProviderActivation = {
  companyPage: LocalStep;
  firstListing: LocalStep;
  ageVerification: LocalStep;
  ageVerificationStatus: ProviderAgeVerificationStatus;
  listings: ActivationListing[];
  publicListingCount: number;
};

type StripeStatus = {
  configured: boolean;
  connect: { state: ProviderPayoutSetupState };
  ageVerification: { status: ProviderAgeVerificationStatus };
};

const labels: Record<ActivationStepStatus, string> = {
  completed: "Completed",
  not_started: "Not started",
  action_required: "Action required",
  under_review: "Under review",
  failed: "Failed",
};

function Step({ title, step, action }: { title: string; step: LocalStep; action?: ReactNode }) {
  const complete = step.status === "completed";
  return <li className="flex flex-col gap-3 rounded-2xl border border-[#183126]/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 gap-3">
      <span aria-hidden="true" className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-[#183126] text-white" : "border border-[#b8aa39] bg-[#fff7c6] text-[#6e631d]"}`}>{complete ? "✓" : "!"}</span>
      <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${complete ? "bg-[#e7f0e6] text-[#315b3d]" : "bg-[#fff1bd] text-[#775f12]"}`}>{labels[step.status]}</span></div><p className="mt-1 text-sm leading-6 text-[#64756c]">{step.detail}</p></div>
    </div>
    {action && !complete && <div className="shrink-0 sm:pl-4">{action}</div>}
  </li>;
}

export default function ProviderActivationChecklist({ activation }: { activation: ProviderActivation }) {
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  const [statusUnavailable, setStatusUnavailable] = useState(false);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [stripeError, setStripeError] = useState("");

  const refreshStripeStatus = useCallback(async () => {
    const response = await fetch("/api/stripe/status", { cache: "no-store" }).catch(() => null);
    if (!response?.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
      setStatusUnavailable(true);
      return;
    }
    const next = await response.json() as StripeStatus;
    if (next.ageVerification.status === "verified" && activation.ageVerificationStatus !== "verified") {
      window.location.reload();
      return;
    }
    setStripe(next);
    setStatusUnavailable(false);
  }, [activation.ageVerificationStatus]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refreshStripeStatus(); }, 0);
    const interval = window.setInterval(() => { void refreshStripeStatus(); }, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [refreshStripeStatus]);

  async function openStripe() {
    setOpeningStripe(true);
    setStripeError("");
    const response = await fetch("/api/stripe/connect", { method: "POST" }).catch(() => null);
    const contentType = response?.headers.get("content-type") ?? "";
    const result = response && contentType.includes("application/json")
      ? await response.json().catch(() => null) as { url?: string; error?: string } | null
      : null;
    if (!response?.ok || !result?.url) {
      setStripeError(result?.error ?? "We could not open Stripe right now. Please try again.");
      setOpeningStripe(false);
      return;
    }
    window.location.assign(result.url);
  }

  const ageStep = stripe ? (() => {
    const status = stripe.ageVerification.status;
    if (status === "verified") return { status: "completed" as const, detail: "Your required age verification is complete." };
    if (status === "pending") return { status: "under_review" as const, detail: "Your age verification is under review." };
    if (status === "requires_input") return { status: "action_required" as const, detail: "Stripe needs more information to complete your age verification." };
    if (status === "failed") return { status: "failed" as const, detail: "Your age verification could not be completed. Please try again." };
    return activation.ageVerification;
  })() : activation.ageVerification;
  const payoutStep = stripe
    ? payoutActivationStep(stripe.connect.state)
    : statusUnavailable
      ? { status: "action_required" as const, detail: "We could not confirm your payout status. Open Stripe setup to make sure your account is ready." }
      : { status: "under_review" as const, detail: "Checking your Stripe payout status." };
  const steps = [activation.companyPage, activation.firstListing, ageStep, payoutStep];
  const completeCount = steps.filter((step) => step.status === "completed").length;
  const allComplete = completeCount === steps.length;
  if (allComplete) return null;

  return <section id="activation-checklist" aria-labelledby="activation-checklist-title" className="mb-6 scroll-mt-24 rounded-[1.75rem] border border-[#d8cb63] bg-[#fff9d9] p-5 shadow-[0_8px_25px_rgba(92,78,18,.06)] sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#74691d]">Provider activation</p><h2 id="activation-checklist-title" className="mt-1 text-2xl font-bold">Get Your Business Ready</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#706942]">Complete each applicable step to publish your services and receive payouts.</p></div><span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#4f604f]">{completeCount}/{steps.length} complete</span></div>
    <ol className="mt-5 grid gap-3">
      <Step title="Create your company page" step={activation.companyPage} action={<Link href="/providers/join" className="inline-flex rounded-full bg-[#183126] px-4 py-2.5 text-xs font-bold text-white">Create company page</Link>} />
      <Step title="Create your first service listing" step={activation.firstListing} action={<Link href="/providers/join" className="inline-flex rounded-full bg-[#183126] px-4 py-2.5 text-xs font-bold text-white">Create service</Link>} />
      <Step title="Complete required age verification" step={ageStep} action={<form action="/api/stripe/provider-age-verification" method="post"><button type="submit" className="rounded-full bg-[#183126] px-4 py-2.5 text-xs font-bold text-white">Verify age</button></form>} />
      <Step title="Connect Stripe payouts" step={payoutStep} action={<button type="button" onClick={() => void openStripe()} disabled={openingStripe || stripe?.configured === false} className="rounded-full bg-[#183126] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{openingStripe ? "Opening Stripe..." : "Set Up Stripe Payouts"}</button>} />
    </ol>
    <p className="mt-3 text-xs leading-5 text-[#706942]">Stripe payout setup is required to receive earnings. It does not determine whether a listing is public.</p>
    {activation.listings.some((listing) => !listing.publiclyAvailable) && <div className="mt-5 rounded-2xl border border-[#dba986] bg-[#fff3e9] p-4"><h3 className="font-bold text-[#7f4528]">Why your listings are not public</h3><div className="mt-3 space-y-3">{activation.listings.filter((listing) => !listing.publiclyAvailable).map((listing) => <div key={listing.id}><p className="text-sm font-bold">{listing.title}</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#765e4c]">{listing.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>)}</div></div>}
    {stripeError && <p role="alert" className="mt-4 rounded-xl bg-[#fff0e8] px-4 py-3 text-sm font-semibold text-[#964f2c]">{stripeError}</p>}
    {stripe?.configured === false && <p role="alert" className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-[#776f45]">Stripe setup is temporarily unavailable. Please try again later.</p>}
  </section>;
}
