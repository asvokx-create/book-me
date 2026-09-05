import Link from "next/link";
import BookingDetails from "@/components/booking-details";

export const dynamic = "force-dynamic";

export default async function ProviderBookingPage({ params }: PageProps<"/provider/dashboard/bookings/[bookingId]">) {
  const { bookingId } = await params;
  return <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
    <header className="border-b border-[#183126]/10 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#183126] text-sm text-[#eee25a]">B</span>BubsBookings</Link><Link href="/account" className="rounded-full border border-[#183126]/15 px-4 py-2 text-sm font-bold transition hover:bg-[#e7eee2]">Switch to customer</Link></div></header>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12"><Link href="/provider/dashboard/bookings" className="text-sm font-bold text-[#62756a] transition hover:text-[#183126]">← Provider bookings</Link><div className="mt-6"><BookingDetails bookingId={bookingId} expectedRole="provider" /></div></div>
  </main>;
}
