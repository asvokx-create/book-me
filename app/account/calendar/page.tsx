import BookingCalendar from "@/components/booking-calendar";
import BackButton from "@/components/back-button";

export default function CustomerCalendarPage() {
  return <main className="min-h-screen bg-[#f5f4ef] px-5 py-8 text-[#183126] sm:px-8"><div className="mx-auto max-w-5xl"><BackButton label="Back to my account" fallbackHref="/account" /><div className="mt-6"><BookingCalendar role="customer" /></div></div></main>;
}
