import type { Metadata } from "next";
import { LegalPage } from "@/app/terms/page";

export const metadata: Metadata = { title: "Provider Agreement | BubsBookings" };

const sections = [
  ["1. Independent providers", "Providers use BubsBookings as independent businesses, not employees or agents of BubsBookings. You control how you perform services and are responsible for applicable registration, licensing, insurance, taxes, workers, equipment, and legal requirements."],
  ["2. Honest listings", "Keep your identity, business details, locations, photos, prices, qualifications, availability, and service descriptions accurate. Starting prices and custom quotes must be clear, lawful, and agreed before confirmation."],
  ["3. Booking service", "Respond promptly, honor confirmed appointments, communicate material changes, and perform services professionally and safely. Keep customer addresses and booking details confidential and use them only to complete the booked service."],
  ["4. Stripe payouts", "Complete Stripe onboarding before accepting online payments and keep your payout information current. Stripe controls verification and payout timing. BubsBookings may deduct the booking fee shown for your active plan and may reverse transfers when a refund, chargeback, or payment correction requires it."],
  ["5. Cancellations, refunds, and disputes", "Publish a reasonable cancellation policy, give customers clear reasons for changes, and review refund requests fairly. Approved refunds return through Stripe to the original payment method. Cooperate with BubsBookings on disputes, chargebacks, safety reports, and requests for relevant service records."],
  ["6. Platform standards", "Follow the Terms of Service, Privacy Policy, safety rules, and all applicable laws. BubsBookings may pause listings, payment access, or accounts when reasonably needed to protect users, investigate reports, meet legal obligations, or address payment risk."],
] as const;

export default function ProviderAgreementPage() {
  return <LegalPage eyebrow="For service professionals" title="Provider Agreement" intro="The marketplace, payment, and service standards that apply when you offer work through BubsBookings." sections={sections} />;
}
