import BrandLockup from "@/components/brand-lockup";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { auth, isAuthConfigured } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const metadata: Metadata = {
  title: "Become a provider",
  description: "List your services, message customers, and send quotes without paying for leads. Compare transparent BubsBookings provider plans.",
  alternates: { canonical: "/providers/join" },
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ProviderJoinPage({ searchParams }: PageProps<"/providers/join">) {
  const requestedPlan = getParam((await searchParams).plan).toLowerCase();
  const planName = requestedPlan === "pro" ? "Pro" : requestedPlan === "starter" ? "Starter" : "";
  const session = isAuthConfigured() ? await auth.api.getSession({ headers: await headers() }) : null;
  const returnPath = `/providers/join${requestedPlan ? `?plan=${encodeURIComponent(requestedPlan)}` : ""}`;
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="provider-join-header border-b border-[#183126]/10 bg-[#f8f7f3]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <BrandLockup />
          </Link>
          <p className="hidden text-sm text-[#6b7c73] sm:block">Already a provider? <Link href="/provider/dashboard" className="font-bold text-[#183126] underline decoration-[#c9be45] decoration-2 underline-offset-4">Open dashboard</Link></p>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[.8fr_1.2fr] lg:py-20">
        <div className="lg:pt-10">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#61756a]">For local professionals</p>
          {planName && <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#edf3e7] px-4 py-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-[#5b9870]" />{planName} plan selected <Link href="/pricing" className="ml-1 underline underline-offset-2">Change</Link></div>}
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-.05em] sm:text-5xl">Do great work.<br /><span className="underline decoration-[#eee25a] decoration-[9px] underline-offset-[-3px]">Get booked.</span></h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-[#617169]">Create your profile, set your own services and schedule, and connect with nearby customers looking for your skills.</p>
          <div className="mt-7 max-w-md rounded-[1.5rem] border border-[#d7ca4d]/45 bg-[#fff9cf] p-5"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#716a31]">A fairer way to get booked</p><h2 className="mt-2 text-xl font-bold">No lead fees. No charge to chat.</h2><p className="mt-2 text-sm leading-6 text-[#5f6e62]">Customer inquiries, replies, and quotes are free. Your plan&apos;s booking fee applies to paid bookings—not to conversations that go nowhere.</p><Link href="/pricing#plans" className="mt-3 inline-flex text-sm font-bold underline decoration-[#b4a52d] decoration-2 underline-offset-4">See transparent pricing →</Link></div>
          <div className="mt-9 space-y-4">
            {["Message customers and send quotes for free", "Keep control of your pricing", "Choose when and where you work", "Build trust with verified reviews"].map((benefit) => <div key={benefit} className="flex items-center gap-3 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#dfeee2] text-[#37724c]">✓</span>{benefit}</div>)}
          </div>
        </div>
        {session || !isAuthConfigured() ? <OnboardingForm plan={requestedPlan === "pro" ? "pro" : "starter"} /> : <aside className="self-start rounded-[2rem] border border-[#183126]/10 bg-white p-7 shadow-[0_20px_60px_rgba(24,49,38,.08)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#687970]">Start your provider profile</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.04em]">Create an account, then publish your first service.</h2>
          <p className="mt-4 text-sm leading-7 text-[#617169]">Choose Starter at $0 per month with a 10% fee on paid bookings, or Pro at $9.99 per month after any eligible trial with a 6% fee on paid bookings. Inquiries, messages, and quotes are free on both plans.</p>
          <ol className="mt-6 space-y-4 text-sm"><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#183126] text-xs font-bold text-white">1</span><span><strong>Create your account.</strong><br /><span className="text-[#687970]">Use email or an available sign-in option.</span></span></li><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#183126] text-xs font-bold text-white">2</span><span><strong>Add your business and service.</strong><br /><span className="text-[#687970]">Set your location, price, duration, photos, and availability.</span></span></li><li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#183126] text-xs font-bold text-white">3</span><span><strong>Receive real customer requests.</strong><br /><span className="text-[#687970]">Ask questions, send quotes, and accept work that fits.</span></span></li></ol>
          <Link href={`/signup?redirect=${encodeURIComponent(returnPath)}`} className="mt-7 flex w-full items-center justify-center rounded-full bg-[#eee25a] px-6 py-3.5 font-bold text-[#183126]">Create provider account</Link>
          <p className="mt-4 text-center text-sm text-[#687970]">Already have an account? <Link href={`/login?redirect=${encodeURIComponent(returnPath)}`} className="font-bold text-[#183126] underline decoration-[#c9be45] decoration-2 underline-offset-4">Log in</Link></p>
          <div className="mt-7 border-t border-[#183126]/10 pt-6"><h3 className="font-bold">Common questions</h3><dl className="mt-4 space-y-4 text-sm"><div><dt className="font-bold">Do I pay for a lead?</dt><dd className="mt-1 leading-6 text-[#687970]">No. Customer inquiries, replies, and quotes do not create a charge.</dd></div><div><dt className="font-bold">When does a booking fee apply?</dt><dd className="mt-1 leading-6 text-[#687970]">Your plan&apos;s percentage fee applies when a paid marketplace booking is completed.</dd></div><div><dt className="font-bold">Can I choose where and when I work?</dt><dd className="mt-1 leading-6 text-[#687970]">Yes. You control your service area, schedule, offerings, and starting prices.</dd></div></dl></div>
        </aside>}
      </section>
    </main>
  );
}
