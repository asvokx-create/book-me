import "server-only";

import { database } from "./database";
import { sendTransactionalEmail } from "./email";

type ProviderWelcomeInput = {
  userId: string;
  email: string;
  name?: string | null;
  businessName: string;
};

export async function sendProviderWelcomeEmail(input: ProviderWelcomeInput) {
  const client = await database.connect();
  const lockKey = `provider-welcome-email:${input.userId}`;
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [lockKey]);
    const existing = await client.query(
      `SELECT 1 FROM email_delivery_log
       WHERE user_id=$1 AND email_type='provider_welcome' AND status='sent'
       LIMIT 1`,
      [input.userId],
    );
    if (existing.rows[0]) return { status: "already_sent" as const };

    const firstName = input.name?.trim().split(/\s+/)[0];
    const delivery = await sendTransactionalEmail({
      to: input.email,
      userId: input.userId,
      emailType: "provider_welcome",
      idempotencyKey: `provider-welcome-${input.userId}`,
      subject: "Welcome to BubsBookings as a service provider",
      heading: `Welcome to BubsBookings${firstName ? `, ${firstName}` : ""}!`,
      message: `${input.businessName} is now set up on BubsBookings. You can manage your services, bookings, availability, customers, and earnings from your provider dashboard.`,
      sections: [{
        heading: "Set Up Your Payouts",
        message: "Before you can receive payments from bookings, you’ll need to connect your Stripe account. You can complete this setup anytime from your provider dashboard.",
      }],
      actionLabel: "Set Up Stripe Payouts",
      actionUrl: "/provider/payout-setup",
    });
    return { status: delivery.sent ? "sent" as const : delivery.skipped ? "skipped" as const : "failed" as const };
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [lockKey]).catch(() => undefined);
    client.release();
  }
}
