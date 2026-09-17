import BrandLockup from "@/components/brand-lockup";
import type { Metadata } from "next";
import Link from "next/link";
import AccountNav from "@/components/account-nav";
import CustomerPayments from "@/components/customer-payments";

export const metadata: Metadata = { title: "Payment methods" };

export default function AccountPaymentsPage() {
  return <main className="min-h-screen bg-[#f5f4ef] text-[#183126]"><header className="relative z-50 border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><BrandLockup /></Link><AccountNav /></div></header><CustomerPayments /></main>;
}
