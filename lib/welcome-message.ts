import "server-only";

import { database } from "./database";
import { sendTransactionalEmail } from "./email";

type NewAccount = {
  id: string;
  email: string;
  name?: string | null;
};

export async function sendAccountWelcome(user: NewAccount) {
  try {
    const existingDelivery = await database.query<{ sent: boolean }>(
      `SELECT true AS sent
       FROM email_delivery_log
       WHERE user_id = $1 AND email_type = 'account_welcome' AND status = 'sent'
       LIMIT 1`,
      [user.id],
    );

    await database.query(
      `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
       VALUES ($1, 'account_welcome', 'Welcome to BubsBookings',
               'Your account is ready. Explore local services, save favorites, and manage your bookings in one place.',
               '/services', $2)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [user.id, `account-welcome-${user.id}`],
    );

    if (existingDelivery.rows[0]?.sent) return { status: "already_sent" as const };

    const delivery = await sendTransactionalEmail({
      to: user.email,
      userId: user.id,
      emailType: "account_welcome",
      idempotencyKey: `account-welcome-${user.id}`,
      subject: "Welcome to BubsBookings",
      heading: `Welcome${user.name ? `, ${user.name.split(/\s+/)[0]}` : ""}!`,
      message: "Your BubsBookings account is ready. You can now explore local services, save favorites, message providers, and keep track of every booking in one place.",
      actionLabel: "Explore local services",
      actionUrl: "/services",
    });
    return { status: delivery.sent ? "sent" as const : delivery.skipped ? "skipped" as const : "failed" as const };
  } catch (error) {
    // Account creation must still succeed if a non-essential welcome delivery fails.
    console.error("Account welcome delivery failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "failed" as const };
  }
}
