import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import DisputeCenter from "@/components/dispute-center";
import { auth } from "@/lib/auth";

export const metadata = { title: "Booking disputes", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/disputes");
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f6f1] p-10 text-center text-[#183126]">Loading resolution center…</main>}><DisputeCenter /></Suspense>;
}
