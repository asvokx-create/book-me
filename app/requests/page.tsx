import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/account-nav";
import BrandLockup from "@/components/brand-lockup";
import MobileSiteNav from "@/components/mobile-site-nav";
import PostJobForm from "@/components/post-job-form";

export const metadata: Metadata = { title: "Request a service", description: "Tell local providers what you need and receive free quotes without lead fees." };

function value(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function PostAJobPage({ searchParams }: PageProps<"/requests">) {
  const params = await searchParams;
  return <main className="min-h-screen bg-[#f4f4ef] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="narrow-mobile-header mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8"><Link href="/" aria-label="BubsBookings home"><BrandLockup compact /></Link><div className="flex items-center gap-2"><AccountNav /><MobileSiteNav /></div></div></header>
    <section className="mx-auto grid max-w-6xl gap-8 px-4 py-9 sm:px-8 sm:py-14 lg:grid-cols-[.75fr_1.25fr] lg:items-start"><div className="lg:sticky lg:top-8"><span className="inline-flex rounded-full bg-[#eee25a] px-3 py-1.5 text-xs font-bold">No lead fees. No charge to chat.</span><h1 className="type-page-title mt-5">One request.<br />Local pros come to you.</h1><p className="mt-5 max-w-lg text-lg leading-8 text-[#61736a]">Describe the work once, receive clear quotes, and only book when you find the right fit.</p><div className="mt-7 grid gap-3 text-sm"><p className="flex gap-3"><span className="font-bold text-[#3f8a5b]">✓</span>Your address stays private until you book</p><p className="flex gap-3"><span className="font-bold text-[#3f8a5b]">✓</span>Providers pay nothing to respond or quote</p><p className="flex gap-3"><span className="font-bold text-[#3f8a5b]">✓</span>Secure checkout stays inside BubsBookings</p></div></div><PostJobForm initialCategory={value(params.category)} initialTitle={value(params.title)} /></section>
  </main>;
}
