import "server-only";

import { sendTransactionalEmail } from "./email";

type FirstListingEmailInput = {
  userId: string;
  email: string;
  name?: string | null;
  businessName: string;
  serviceTitle: string;
};

export function sendFirstListingSuccessEmail(input: FirstListingEmailInput) {
  const firstName = input.name?.trim().split(/\s+/)[0];

  return sendTransactionalEmail({
    to: input.email,
    userId: input.userId,
    emailType: "provider_first_listing_success_guide",
    idempotencyKey: `provider-first-listing-success-guide-${input.userId}`,
    subject: "Your first listing is live — here’s how to get booked",
    heading: `Your provider journey starts now${firstName ? `, ${firstName}` : ""}`,
    message: `${input.serviceTitle} is now live under ${input.businessName}. A few thoughtful details can make a big difference when customers compare providers.`,
    tips: [
      "Add 3–5 bright, recent photos that show the quality of your real work.",
      "Explain exactly what the starting price includes so customers can book confidently.",
      "Keep your availability and service area current to avoid requests you cannot accept.",
      "Reply quickly and professionally—fast responses build trust and help win bookings.",
      "Connect Stripe before your first job so customer payments and payouts are ready.",
      "After a great job, invite the customer to leave an honest BubsBookings review.",
    ],
    actionLabel: "Improve my provider profile",
    actionUrl: "/provider/dashboard",
  });
}
