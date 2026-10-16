import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/app/terms/page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Payment and Billing Policy",
  description: "Learn how BubsBookings customer charges, provider plan billing, marketplace fees, refunds, and Stripe transfers work.",
  pathname: "/payment-billing",
});

const sections = [
  ["1. Stripe processing", "BubsBookings uses Stripe for customer payment, provider subscription billing, connected-provider transfers, and related payment operations. Stripe’s own terms and privacy policy also apply to Stripe services. BubsBookings does not store full payment-card numbers or bank-login credentials."],
  ["2. Customer booking charges", "A customer charge is created only after the booking flow displays the applicable service price, selected duration where applicable, coupon result, and BubsBookings service fee. The current BubsBookings customer service fee is $2.99 and is shown separately at checkout. BubsBookings does not add a separate percentage card-processing surcharge to the customer total."],
  ["3. Provider marketplace fees and processing costs", "BubsBookings calculates the provider plan fee from the paid service subtotal using server-side cents. Starter has a 10% BubsBookings platform fee capped at $200 per booking; Pro has a 6% BubsBookings platform fee capped at $100 per booking. The platform fee cap applies only to the BubsBookings platform fee, not Stripe processing costs. Under the current separate-charges-and-transfers payment model, Stripe charges its actual processing fee to BubsBookings’ platform charge. BubsBookings allocates the service portion of the Stripe-reported charge fee to the provider and absorbs the portion attributable to the $2.99 customer service fee. The provider’s booking record distinguishes the platform fee from the finalized Stripe processing cost. Existing finalized bookings retain their recorded financial terms."],
  ["4. Provider subscriptions", "Starter has no monthly subscription charge. The current Pro subscription is $9.99 per month. An eligible provider company may receive one 30-day Pro trial with a payment method; the plan automatically renews unless canceled before the trial ends. Providers can schedule cancellation from billing controls and keep the plan through the current paid or trial period. The current product checkout supports Pro; do not assume that every plan shown internally is available for self-service purchase."],
  ["5. Transfers, tips, taxes, and payout timing", "BubsBookings uses separate charges and transfers. A provider transfer is created after the booking is eligible for release and can be delayed by the completion-review period, a dispute, refund, fraud or compliance review, missing payout setup, Stripe requirements, or legal restrictions. Optional customer tips are processed separately and, when successfully paid and transferred, are intended for the provider rather than retained as a BubsBookings marketplace fee. Providers and partners remain responsible for their taxes and accurate Stripe information; Stripe may request tax information or issue reporting documents when applicable."],
  ["6. Refunds, chargebacks, and corrections", <><p>See the <Link href="/cancellations-refunds" className="font-bold underline">Cancellation & Refund Policy</Link> for booking refunds and disputes. Refunds and chargebacks can reduce, delay, reverse, or offset a provider transfer or a Partner commission where allowed. Stripe and card-network processes can also affect timing and outcome.</p></>],
  ["7. Questions", <><p>For a charge, refund, or subscription question, first use the relevant booking or provider billing screen, then <Link href="/support" className="font-bold underline">contact support</Link> with the account email and relevant booking or invoice information. Do not send card numbers, bank credentials, or authentication codes by message or email.</p></>],
] as const;

export default function PaymentBillingPage() {
  return <LegalPage eyebrow="Payments and plans" title="Payment & Billing Policy" intro="A clear guide to customer charges, provider plans, Stripe processing, and marketplace transfers." sections={sections} />;
}
