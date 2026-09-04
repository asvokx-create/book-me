import Link from "next/link";
import BookingCalendar from "@/components/booking-calendar";

export default function CustomerCalendarPage() {
  return <main className="min-h-screen bg-[#f5f4ef] px-5 py-8 text-[#183126] sm:px-8"><div className="mx-auto max-w-5xl"><Link href="/account" className="text-sm font-bold hover:underline">← Back to my account</Link><div className="mt-6"><BookingCalendar role="customer" /></div></div></main>;
}
