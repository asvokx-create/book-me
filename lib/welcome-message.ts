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
    const notification = await database.query(
      `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
       VALUES ($1, 'account_welcome', 'Welcome to BubsBookings',
               'Your account is ready. Explore local services, save favorites, and manage your bookings in one place.',
               '/services', $2)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [user.id, `account-welcome-${user.id}`],
    );

    if (!notification.rowCount) return;

    await sendTransactionalEmail({
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
  } catch (error) {
    // Account creation must still succeed if a non-essential welcome delivery fails.
    console.error("Account welcome delivery failed", {
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
