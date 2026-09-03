import Link from "next/link";
import AccountNav from "@/components/account-nav";
import BookingDetails from "@/components/booking-details";

export const dynamic = "force-dynamic";

export default async function CustomerBookingPage({ params }: PageProps<"/account/bookings/[bookingId]">) {
  const { bookingId } = await params;
  return <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
    <header className="relative z-50 border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BookMe</Link><AccountNav /></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12"><Link href="/account" className="text-sm font-bold text-[#62756a] transition hover:text-[#183126]">← My bookings</Link><div className="mt-6"><BookingDetails bookingId={bookingId} expectedRole="customer" /></div></div>
  </main>;
}
