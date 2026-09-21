import Link from "next/link";
import BrandLockup from "@/components/brand-lockup";
import JobRequestCenter from "@/components/job-request-center";
import NotificationBell from "@/components/notification-bell";

export default function AccountRequestsPage() {
  return <main className="min-h-screen bg-[#f4f4ef] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-8"><Link href="/"><BrandLockup compact /></Link><div className="flex items-center gap-2"><NotificationBell /><Link href="/account" className="rounded-full border border-[#183126]/15 px-4 py-2.5 text-sm font-bold">My account</Link></div></div></header><div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12"><JobRequestCenter mode="customer" /></div></main>;
}
