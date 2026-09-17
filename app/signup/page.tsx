import BrandLockup from "@/components/brand-lockup";
import type { Metadata } from "next";
import Link from "next/link";
import AuthForm from "../auth-form";
import { getSocialProviderAvailability } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account", robots: { index: false, follow: false } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const query = await searchParams;
  const redirectTo = query.redirect?.startsWith("/") && !query.redirect.startsWith("//") ? query.redirect : "/account";
  const socialProviders = getSocialProviderAvailability();
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f8f7f3] px-5 py-8 text-[#183126]">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#d8e7d3] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-52 -left-40 h-[500px] w-[500px] rounded-full bg-[#f3eca0]/60 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <Link href="/" className="flex items-center gap-2.5 self-start text-xl font-bold tracking-tight"><BrandLockup /></Link>
        <div className="flex flex-1 items-center justify-center py-10"><AuthForm mode="signup" redirectTo={redirectTo} socialProviders={socialProviders} /></div>
      </div>
    </main>
  );
}
