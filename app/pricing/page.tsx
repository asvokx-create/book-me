import BrandLockup from "@/components/brand-lockup";
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
    features: ["No lead, inquiry, message, or quote fees", "2 services with up to 5 photos", "Share link, QR code & listing tools", "Booking calendar & customer messaging", "24-hour reminders & basic analytics", "Single-owner access"],
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    cadence: "per month",
    fee: "6% booking fee",
    description: "Every growth tool in one affordable plan.",
    features: ["No lead, inquiry, message, or quote fees", "Unlimited services, photos & locations", "Share links, QR codes & listing tools", "Custom questions & advanced reminders", "Advanced analytics & repeat-customer insights", "3 team seats included", "Extra employees for $0.50/month each", "Priority support & browse placement"],
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
    <main className="pricing-page min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:px-8 sm:py-5">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight sm:gap-2.5 sm:text-2xl"><BrandLockup /></Link>
          <div className="flex items-center gap-2 sm:gap-3"><nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex"><Link href="/services" className="site-nav-link">Find services</Link><Link href="/guides" className="site-nav-link">Guides</Link></nav><AccountNav /></div>
        </div>
      </header>

      <section className="pricing-hero relative overflow-hidden border-b border-[#183126]/10">
        <div className="pointer-events-none absolute -right-24 -top-44 h-[620px] w-[620px] rounded-full bg-[#b7d7b8]/55 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-36 h-[420px] w-[420px] rounded-full bg-[#eee25a]/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 text-left sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_.85fr] lg:gap-16 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-[#d2dfd7]"><span className="h-2 w-2 rounded-full bg-[#eee25a]" />Simple, fair provider pricing</p>
            <h1 className="mt-6 max-w-3xl text-[clamp(2.7rem,7vw,4.5rem)] font-bold leading-[.98] tracking-[-.055em]">Start free.<br /><span className="text-[#eee25a]">Grow on your terms.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#d1ddd6] sm:text-lg sm:leading-8">Build your profile, talk with customers, and send quotes without paying for leads. Upgrade only when the extra tools make sense for your business.</p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href={currentPlan === "pro" ? "/provider/dashboard/billing" : "/pricing?plan=pro#plans"} className="inline-flex rounded-full bg-[#eee25a] px-7 py-4 text-base font-bold text-[#183126] shadow-[0_14px_34px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">{currentPlan === "owner" ? "View the 30-day Pro trial" : currentPlan === "pro" ? "Manage your Pro plan" : "Start 30-day Pro trial"}</Link>
              <a href="#plans" className="inline-flex min-h-11 items-center text-sm font-bold text-white underline decoration-white/35 decoration-2 underline-offset-4 transition hover:decoration-[#eee25a]">Compare plans ↓</a>
            </div>
          </div>
          <aside className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-[rgba(7,42,29,.72)] p-6 shadow-[0_24px_70px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#eee25a]/15 blur-3xl" />
            <p className="relative text-xs font-bold uppercase tracking-[.17em] text-[#c8d7cf]">Your cost before a booking</p>
            <div className="relative mt-3 flex items-end gap-3"><span className="text-6xl font-bold tracking-[-.06em] text-white">$0</span><span className="pb-2 text-sm font-semibold text-[#c8d7cf]">always</span></div>
            <div className="relative mt-6 grid gap-3">
              {['Receive customer inquiries', 'Chat with customers', 'Create and send quotes'].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b2d20]/35 px-4 py-3 text-sm font-semibold text-white"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eee25a] text-xs font-black text-[#183126]">✓</span>{item}</div>)}
            </div>
            <p className="relative mt-5 text-sm leading-6 text-[#c8d7cf]">A booking fee applies only after you complete a paid booking.</p>
          </aside>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
        <section className="mb-10 overflow-hidden rounded-[2rem] border border-[#183126]/10 bg-white shadow-[0_20px_55px_rgba(24,49,38,.09)]">
          <div className="grid lg:grid-cols-[1.15fr_.85fr]">
            <div className="p-6 sm:p-9 lg:p-10">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-[#64766d]"><span className="h-2 w-2 rounded-full bg-[#d8ca35]" />The BubsBookings provider promise</p>
              <h2 className="mt-4 max-w-xl text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.02] tracking-[-.045em]">Keep the conversation.<br /><span className="text-[#4a9a68]">Skip the lead fees.</span></h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#5d6e60]">Receive inquiries, reply to customers, and send quotes without paying a cent for the conversation. You only pay a booking fee when real work gets booked and paid.</p>
              <Link href="/guides/why-bubsbookings-does-not-charge-for-leads" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold transition hover:border-[#183126]/30 hover:bg-[#f4f6f1]">See exactly how our fees work <span aria-hidden="true">→</span></Link>
            </div>
            <div className="flex flex-col justify-center gap-3 bg-[#eef3e9] p-5 sm:p-7 lg:p-8">
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_6px_20px_rgba(24,49,38,.05)]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Customer inquiries</p><p className="mt-1 text-sm text-[#687970]">New opportunities</p></div><p className="text-3xl font-bold tracking-[-.04em] text-[#3e8b5b]">$0</p></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_6px_20px_rgba(24,49,38,.05)]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#718078]">Messages & quotes</p><p className="mt-1 text-sm text-[#687970]">Every conversation</p></div><p className="text-3xl font-bold tracking-[-.04em] text-[#3e8b5b]">$0</p></div>
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#183126] px-5 py-4 text-white shadow-[0_12px_30px_rgba(24,49,38,.18)]"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#b8c8c0]">Booking fee</p><p className="mt-1 text-sm text-[#d8e2dc]">When you get paid</p></div><p className="max-w-28 text-right text-base font-bold leading-5">Paid bookings only</p></div>
            </div>
          </div>
        </section>
        {currentPlan && <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#183126] px-5 py-4 text-center text-white sm:flex-row sm:text-left"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b8c8c0]">Your current plan</p><p className="mt-1 text-xl font-bold">{PLAN_ENTITLEMENTS[currentPlan].name}</p>{currentPlan === "owner" && <p className="mt-1 text-xs text-[#b8c8c0]">Private account access · $0/month · 0% booking fee · all features unlocked</p>}</div><Link href="/provider/dashboard/billing" className="shrink-0 rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">Manage billing</Link></div>}
        {selectedPlan && <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#edf3e7] px-5 py-4 text-center sm:flex-row sm:text-left"><div><p className="font-bold">{selectedPlan.name} selected</p><p className="mt-1 text-sm text-[#64766d]">{selectedPlan.id === "starter" ? "Create your provider profile for free." : proTrialEligible ? "Create your provider profile first, then start the 30-day trial securely from Billing." : "Continue to Billing to subscribe securely through Stripe."}</p></div><Link href={selectedPlan.id === "starter" ? "/providers/join?plan=starter" : currentProvider ? "/provider/dashboard/billing" : "/providers/join?plan=pro"} className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#294b3c]">{selectedPlan.id === "starter" ? "Continue as a provider" : currentProvider ? "Continue to billing" : "Create provider profile"}</Link></div>}

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return <article key={plan.id} className={`pricing-plan-card relative flex flex-col rounded-[2rem] border bg-white p-7 sm:p-8 ${plan.featured || isCurrent ? "border-[#183126] ring-4 ring-[#eee25a]/60" : "border-[#183126]/10"}`}>
            {plan.featured && <span className="absolute -top-3 left-7 rounded-full bg-[#eee25a] px-3 py-1 text-xs font-bold">Most popular</span>}
            {isCurrent && <span className="absolute -top-3 right-7 rounded-full bg-[#183126] px-3 py-1 text-xs font-bold text-white">Current plan</span>}
            <h2 className="text-2xl font-bold">{plan.name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#687970]">{plan.description}</p>
            <div className="mt-7 flex items-end gap-2"><span className="text-4xl font-bold tracking-[-.04em]">{plan.price}</span><span className="pb-1 text-sm text-[#6f7f77]">{plan.cadence}</span></div>
            {plan.id === "pro" && showTrialPromotion && <p className="mt-3 rounded-2xl bg-[#fff9d9] px-4 py-3 text-sm font-bold text-[#66580b]">Eligible provider companies get 30 days free, then $9.99/month</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-bold text-[#496756]">{plan.fee}</span>
              {plan.id === "pro" && <span className="inline-flex w-fit rounded-full bg-[#183126] px-3 py-1.5 text-xs font-bold text-white">Save at $250+/month booked</span>}
            </div>
            {plan.id === "pro" && <p className="mt-2 text-xs leading-5 text-[#74827b]">At $250+ in monthly bookings, Pro&apos;s lower 6% fee offsets the monthly price.</p>}
            <ul className="mt-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm"><span className="font-bold text-[#4c8a60]">✓</span><span>{feature}</span></li>)}</ul>
            {isCurrent
              ? <span className="mt-8 rounded-full bg-[#edf3e7] px-5 py-3.5 text-center text-sm font-bold text-[#496756]">Your current plan</span>
              : plan.id === "starter"
                ? <Link href={`/pricing?plan=${plan.id}#plans`} className="mt-8 rounded-full bg-[#183126] px-5 py-3.5 text-center text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#294b3c]">{selected === plan.id ? "Selected" : "Choose Starter"}</Link>
                : <Link href="/pricing?plan=pro#plans" className="mt-8 rounded-full bg-[#eee25a] px-5 py-3.5 text-center text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f5ea6b]">{currentPlan === "owner" ? "Pro is included in Owner Plan" : proTrialEligible ? "Start 30-day free trial" : "Choose Pro for $9.99"}</Link>}
          </article>})}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-[#74827b]">The Pro trial is available once per provider company and requires a card. It automatically renews at $9.99 per month after 30 days unless canceled before the trial ends. The 6% booking fee applies during the trial. All subscription details are shown again in Stripe Checkout.</p>
        </div>
      </section>
    </main>
  );
}
