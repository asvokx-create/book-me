import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import AdminProviderOutreach from "@/components/admin-provider-outreach";
import { getAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminProviderOutreachPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/growth/outreach");
  return <main className="min-h-screen bg-[#f4f4ef] px-4 py-7 text-[#183126] sm:px-8 sm:py-8"><div className="mx-auto max-w-6xl"><div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin growth</p><h1 className="mt-2 text-3xl font-bold">Provider outreach CRM</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#687970]">Research and review potential providers before any contact is sent.</p></div><BackButton label="Back to growth" fallbackHref="/admin/growth" /></div><AdminProviderOutreach /></div></main>;
}
