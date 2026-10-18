import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import AdminJarvis from "@/components/admin-jarvis";
import { getAdminSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function JarvisPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/jarvis");
  return <main className="min-h-screen bg-[#f4f4ef] px-4 py-7 text-[#183126] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Admin operations</p><h1 className="mt-2 text-4xl font-bold">Jarvis</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#64756c]">Ask read-only questions about aggregate BubsBookings operations. Jarvis cannot change accounts, payments, deployments, or production data.</p></div>
        <BackButton label="Back to admin" fallbackHref="/admin" />
      </div>
      <AdminJarvis />
    </div>
  </main>;
}
