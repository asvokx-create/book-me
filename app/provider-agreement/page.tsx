import type { Metadata } from "next";
import { LegalPage } from "@/app/terms/page";

export const metadata: Metadata = { title: "Provider Agreement | BubsBookings" };

const sections = [
  ["1. Independent providers", "Providers use BubsBookings as independent businesses, not employees or agents of BubsBookings. You control how you perform services and are responsible for applicable registration, licensing, insurance, taxes, workers, equipment, and legal requirements."],
  ["2. Honest listings", "Keep your identity, business details, locations, photos, prices, qualifications, availability, and service descriptions accurate. Starting prices and custom quotes must be clear, lawful, and agreed before confirmation."],
  ["3. Booking service", "Respond promptly, honor confirmed appointments, communicate material changes, and perform services professionally and safely. Keep customer addresses and booking details confidential and use them only to complete the booked service."],
  ["4. Stripe payouts", "Complete Stripe onboarding before accepting online payments and keep your payout information current. For eligible marketplace payments, BubsBookings holds the provider share in its Stripe platform balance until service completion is confirmed by the customer or automatically after the 48-hour confirmation window. BubsBookings deducts the booking fee for your active plan before releasing the transfer. Stripe controls bank-payout timing after the transfer reaches your connected account."],
  ["5. Cancellations, refunds, payout holds, and disputes", "Mark work complete only after performing the agreed service. Publish a reasonable cancellation policy, give customers clear reasons for changes, and review refund requests fairly. BubsBookings may delay, freeze, reverse, or offset transfers to address cancellations, refunds, chargebacks, disputes, suspected fraud, payment corrections, or legal obligations. Cooperate with requests for relevant service records. A transfer reversal can reduce your Stripe balance or future earnings."],
  ["6. Platform standards", "Follow the Terms of Service, Privacy Policy, safety rules, and all applicable laws. BubsBookings may pause listings, payment access, or accounts when reasonably needed to protect users, investigate reports, meet legal obligations, or address payment risk."],
] as const;

export default function ProviderAgreementPage() {
  return <LegalPage eyebrow="For service professionals" title="Provider Agreement" intro="The marketplace, payment, and service standards that apply when you offer work through BubsBookings." sections={sections} />;
}
