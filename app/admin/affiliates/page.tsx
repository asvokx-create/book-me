import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLockup from "@/components/brand-lockup";
import AffiliateAdmin from "@/components/affiliate-admin";
import { getAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminAffiliatesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/affiliates");
  return <main className="min-h-screen bg-[#f4f4ef] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="dashboard-container flex items-center justify-between px-5 py-4"><Link href="/"><BrandLockup /></Link><Link href="/admin" className="rounded-full border border-[#183126]/15 px-5 py-2.5 text-sm font-bold">← Admin console</Link></div></header><AffiliateAdmin /></main>;
}
