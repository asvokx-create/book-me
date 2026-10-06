import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLockup from "@/components/brand-lockup";
import AdminExpenses from "@/components/admin-expenses";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import type { AdminExpense } from "@/lib/admin-expenses";
import { getAdminFinancialSummary } from "@/lib/admin-financial-summary";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/expenses");
  const [result, financialSummary] = await Promise.all([database.query<AdminExpense>(`SELECT id::text, service_name, notes, cost_cents, billing_cycle,
    next_renewal_date::text, status, created_at::text, updated_at::text
    FROM admin_expenses ORDER BY status ASC, next_renewal_date ASC NULLS LAST, service_name ASC`), getAdminFinancialSummary()]);
  return <main className="min-h-screen overflow-x-clip bg-[#f4f4ef] text-[#183126]"><header className="border-b border-[#183126]/10 bg-white"><div className="dashboard-container flex items-center justify-between gap-4 px-5 py-4"><Link href="/"><BrandLockup /></Link><Link href="/admin" className="shrink-0 rounded-full border border-[#183126]/15 px-4 py-2.5 text-sm font-bold sm:px-5">← Admin console</Link></div></header><AdminExpenses initialExpenses={result.rows} initialPlatformRevenueCents={financialSummary.platformRevenueCents} /></main>;
}
