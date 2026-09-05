import { Suspense } from "react";
import DisputeCenter from "@/components/dispute-center";

export const metadata = { title: "Booking disputes | BubsBookings" };

export default function DisputesPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f6f6f1] p-10 text-center text-[#183126]">Loading resolution center…</main>}><DisputeCenter /></Suspense>;
}
