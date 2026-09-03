import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const metadata: Metadata = {
  title: "Become a provider | BookMe",
  description: "Grow your local service business with BookMe.",
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ProviderJoinPage({ searchParams }: PageProps<"/providers/join">) {
  const requestedPlan = getParam((await searchParams).plan).toLowerCase();
  const planName = requestedPlan === "pro" ? "Pro" : requestedPlan === "business" ? "Business" : requestedPlan === "starter" ? "Starter" : "";
  if (isAuthConfigured()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      const returnPath = `/providers/join${requestedPlan ? `?plan=${encodeURIComponent(requestedPlan)}` : ""}`;
      redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
    }
  }
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#183126]">
      <header className="border-b border-[#183126]/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-base text-[#eee25a]">B</span>
            BookMe
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
          <div className="mt-9 space-y-4">
            {["Keep control of your pricing", "Choose when and where you work", "Build trust with verified reviews"].map((benefit) => <div key={benefit} className="flex items-center gap-3 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#dfeee2] text-[#37724c]">✓</span>{benefit}</div>)}
          </div>
        </div>
        <OnboardingForm />
      </section>
    </main>
  );
}
