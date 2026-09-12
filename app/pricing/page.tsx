import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import AccountNav from "@/components/account-nav";
import { auth, isAuthConfigured } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/admin";
import { database } from "@/lib/database";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getStripeMode } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Provider pricing",
  description: "Choose the BubsBookings plan that fits your local service business.",
  alternates: { canonical: "/pricing" },
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    cadence: "forever",
    fee: "10% booking fee",
    description: "Everything you need to start getting booked.",
    features: ["Up to 2 services", "Up to 5 photos", "Booking calendar", "Customer messaging", "24-hour booking reminders", "Basic analytics", "Owner only"],
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    cadence: "per month",
    fee: "6% booking fee",
    description: "Every growth tool in one affordable plan.",
    features: ["Unlimited services & photos", "Custom booking questions", "24-hour and 1-hour reminders", "Advanced analytics", "Repeat-customer insights", "3 total team seats included", "Extra employees for $0.50/month each", "Multiple service locations", "Priority support", "Priority placement in browse results"],
    featured: true,
  },
] as const;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type CurrentProviderPlan = { plan: ProviderPlan; trialEligible: boolean };

async function getCurrentProviderPlan(): Promise<CurrentProviderPlan | null> {
  if (!isAuthConfigured()) return null;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;
    if (isOwnerEmail(session.user.email)) return { plan: "owner", trialEligible: false };
    const result = await database.query<{ plan: ProviderPlan; pro_trial_used_at_test: Date | null; pro_trial_used_at_live: Date | null }>(
      `SELECT plan, pro_trial_used_at_test, pro_trial_used_at_live
       FROM provider_profiles WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [session.user.id],
    );
    const provider = result.rows[0];
    if (!provider) return null;
    const mode = getStripeMode();
    return { plan: provider.plan, trialEligible: mode === "live" ? !provider.pro_trial_used_at_live : !provider.pro_trial_used_at_test };
  } catch {
    return null;
  }
}

export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const selected = getParam((await searchParams).plan).toLowerCase();
  const selectedPlan = plans.find((plan) => plan.id === selected);
  const currentProvider = await getCurrentProviderPlan();
  const currentPlan = currentProvider?.plan ?? null;
  const proTrialEligible = currentProvider?.trialEligible ?? true;
  const showTrialPromotion = proTrialEligible || currentPlan === "owner";

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:gap-2.5 sm:text-2xl"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span><span className="hidden min-[390px]:inline">BubsBookings</span><span className="min-[390px]:hidden">Bubs</span></Link>
          <div className="flex items-center gap-2 sm:gap-3"><Link href="/services" className="hidden rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-[#183126]/5 sm:block">Find a service</Link><AccountNav /></div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#183126]/10">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-[#d8e7d3] blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:px-8 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#65796d]">Simple provider pricing</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-[clamp(2.4rem,8vw,3.75rem)] font-bold leading-tight tracking-[-.05em]">Start free. Grow when <span className="underline decoration-[#eee25a] decoration-[10px] underline-offset-[-4px]">you&apos;re ready.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#607269]">Every plan includes a business profile, services, scheduling, customer messaging, reviews, and secure online payments. Eligible providers can try Pro free for 30 days.</p>
          <Link href={currentPlan === "pro" ? "/provider/dashboard/billing" : "/pricing?plan=pro#plans"} className="mt-7 inline-flex rounded-full bg-[#eee25a] px-7 py-4 text-base font-bold shadow-[0_12px_30px_rgba(24,49,38,.14)] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">{currentPlan === "owner" ? "View the 30-day Pro trial" : currentPlan === "pro" ? "Manage your Pro plan" : "Start 30-day Pro trial"}</Link>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-20">
        {currentPlan && <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#183126] px-5 py-4 text-center text-white sm:flex-row sm:text-left"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b8c8c0]">Your current plan</p><p className="mt-1 text-xl font-bold">{PLAN_ENTITLEMENTS[currentPlan].name}</p>{currentPlan === "owner" && <p className="mt-1 text-xs text-[#b8c8c0]">Private account access · $0/month · 0% booking fee · all features unlocked</p>}</div><Link href="/provider/dashboard/billing" className="shrink-0 rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Manage billing</Link></div>}
        {selectedPlan && <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#edf3e7] px-5 py-4 text-center sm:flex-row sm:text-left"><div><p className="font-bold">{selectedPlan.name} selected</p><p className="mt-1 text-sm text-[#64766d]">{selectedPlan.id === "starter" ? "Create your provider profile for free." : proTrialEligible ? "Create your provider profile first, then start the 30-day trial securely from Billing." : "Continue to Billing to subscribe securely through Stripe."}</p></div><Link href={selectedPlan.id === "starter" ? "/providers/join?plan=starter" : currentProvider ? "/provider/dashboard/billing" : "/providers/join?plan=pro"} className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#294b3c]">{selectedPlan.id === "starter" ? "Continue as a provider" : currentProvider ? "Continue to billing" : "Create provider profile"}</Link></div>}

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return <article key={plan.id} className={`relative flex flex-col rounded-[2rem] border bg-white p-7 shadow-[0_10px_35px_rgba(24,49,38,.06)] sm:p-8 ${plan.featured || isCurrent ? "border-[#183126] ring-4 ring-[#eee25a]/60" : "border-[#183126]/10"}`}>
            {plan.featured && <span className="absolute -top-3 left-7 rounded-full bg-[#eee25a] px-3 py-1 text-xs font-bold">Most popular</span>}
            {isCurrent && <span className="absolute -top-3 right-7 rounded-full bg-[#183126] px-3 py-1 text-xs font-bold text-white">Current plan</span>}
            <h2 className="text-2xl font-bold">{plan.name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#687970]">{plan.description}</p>
            <div className="mt-7 flex items-end gap-2"><span className="text-4xl font-bold tracking-[-.04em]">{plan.price}</span><span className="pb-1 text-sm text-[#6f7f77]">{plan.cadence}</span></div>
            {plan.id === "pro" && showTrialPromotion && <p className="mt-3 rounded-2xl bg-[#fff9d9] px-4 py-3 text-sm font-bold text-[#66580b]">Eligible provider companies get 30 days free, then $9.99/month</p>}
            <p className="mt-2 inline-flex w-fit rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-bold text-[#496756]">{plan.fee}</p>
            <ul className="mt-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm"><span className="font-bold text-[#4c8a60]">✓</span><span>{feature}</span></li>)}</ul>
            {isCurrent
              ? <span className="mt-8 rounded-full bg-[#edf3e7] px-5 py-3.5 text-center text-sm font-bold text-[#496756]">Your current plan</span>
              : plan.id === "starter"
                ? <Link href={`/pricing?plan=${plan.id}#plans`} className="mt-8 rounded-full bg-[#183126] px-5 py-3.5 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#294b3c]">{selected === plan.id ? "Selected" : "Choose Starter"}</Link>
                : <Link href="/pricing?plan=pro#plans" className="mt-8 rounded-full bg-[#eee25a] px-5 py-3.5 text-center text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">{currentPlan === "owner" ? "Pro is included in Owner Plan" : proTrialEligible ? "Start 30-day free trial" : "Choose Pro for $9.99"}</Link>}
          </article>})}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-[#74827b]">The Pro trial is available once per provider company and requires a card. It automatically renews at $9.99 per month after 30 days unless canceled before the trial ends. The 6% booking fee applies during the trial. All subscription details are shown again in Stripe Checkout.</p>
      </section>
    </main>
  );
}
