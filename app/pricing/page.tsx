import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/account-nav";

export const metadata: Metadata = {
  title: "Provider pricing | BubsBookings",
  description: "Choose the BubsBookings plan that fits your local service business.",
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    cadence: "forever",
    fee: "8% booking fee",
    description: "Everything you need to start getting booked.",
    features: ["Up to 5 services", "Up to 10 photos", "Booking calendar", "Customer messaging", "Basic reminders", "Basic analytics", "1 team member"],
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19.99",
    cadence: "per month",
    fee: "4% booking fee",
    description: "More tools for a growing service business.",
    features: ["Unlimited services & photos", "BubsBookings AI assistant", "Custom booking questions", "Automated reminders", "Advanced analytics", "Promo codes", "Repeat-customer tools", "Up to 3 team members"],
    featured: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$49.99",
    cadence: "per month",
    fee: "2% booking fee",
    description: "Powerful controls for established teams.",
    features: ["Everything in Pro", "Unlimited team members", "Multiple locations", "Priority support", "Higher featured placement", "Advanced analytics", "Unlimited services & photos"],
    featured: false,
  },
] as const;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function PricingPage({ searchParams }: PageProps<"/pricing">) {
  const selected = getParam((await searchParams).plan).toLowerCase();
  const selectedPlan = plans.find((plan) => plan.id === selected);

  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-[#f8f7f3]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>BubsBookings</Link>
          <div className="flex items-center gap-2 sm:gap-3"><Link href="/services" className="hidden rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-[#183126]/5 sm:block">Find a service</Link><AccountNav /></div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[#183126]/10">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] rounded-full bg-[#d8e7d3] blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#65796d]">Simple provider pricing</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">Start free. Grow when <span className="underline decoration-[#eee25a] decoration-[10px] underline-offset-[-4px]">you&apos;re ready.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#607269]">Every plan includes a business profile, services, scheduling, customer messaging, reviews, and online payments.</p>
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        {selectedPlan && <div className="mb-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#183126]/10 bg-[#edf3e7] px-5 py-4 text-center sm:flex-row sm:text-left"><div><p className="font-bold">{selectedPlan.name} selected</p><p className="mt-1 text-sm text-[#64766d]">Your choice is saved in this signup link. Billing is not active yet, so you will not be charged.</p></div><Link href={`/providers/join?plan=${selectedPlan.id}`} className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#294b3c]">Continue as a provider</Link></div>}

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => <article key={plan.id} className={`relative flex flex-col rounded-[2rem] border bg-white p-7 shadow-[0_10px_35px_rgba(24,49,38,.06)] sm:p-8 ${plan.featured ? "border-[#183126] ring-4 ring-[#eee25a]/60" : "border-[#183126]/10"}`}>
            {plan.featured && <span className="absolute -top-3 left-7 rounded-full bg-[#eee25a] px-3 py-1 text-xs font-bold">Most popular</span>}
            <h2 className="text-2xl font-bold">{plan.name}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#687970]">{plan.description}</p>
            <div className="mt-7 flex items-end gap-2"><span className="text-4xl font-bold tracking-[-.04em]">{plan.price}</span><span className="pb-1 text-sm text-[#6f7f77]">{plan.cadence}</span></div>
            <p className="mt-2 inline-flex w-fit rounded-full bg-[#edf3e7] px-3 py-1.5 text-xs font-bold text-[#496756]">{plan.fee}</p>
            <ul className="mt-7 flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm"><span className="font-bold text-[#4c8a60]">✓</span><span>{feature}</span></li>)}</ul>
            <Link href={`/pricing?plan=${plan.id}#plans`} className={`mt-8 rounded-full px-5 py-3.5 text-center text-sm font-bold transition hover:-translate-y-0.5 ${plan.featured ? "bg-[#eee25a] hover:bg-[#f5ea6b]" : "bg-[#183126] text-white hover:bg-[#294b3c]"}`}>{selected === plan.id ? "Selected" : `Choose ${plan.name}`}</Link>
          </article>)}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-[#74827b]">Plan selection is available now. Paid subscriptions and booking fees will only begin after secure payment processing is connected and you confirm a purchase.</p>
      </section>
    </main>
  );
}
