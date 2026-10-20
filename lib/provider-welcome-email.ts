import "server-only";

import type { PoolClient } from "pg";
import { database } from "./database";
import { sendTransactionalEmail } from "./email";

type ProviderWelcomeInput = {
  userId: string;
  providerId: string;
};

type WelcomeRow = {
  user_id: string;
  provider_id: string;
  attempt_count: number;
  email: string;
  name: string | null;
  business_name: string;
};

const retryDelayMinutes = (attempt: number) => Math.min(15 * (2 ** Math.max(attempt - 1, 0)), 360);

export async function enqueueProviderWelcomeEmail(input: ProviderWelcomeInput, client: PoolClient | typeof database = database) {
  await client.query(
    `INSERT INTO provider_welcome_email_deliveries (user_id, provider_id, status, next_attempt_at)
     VALUES ($1, $2, 'queued', now())
     ON CONFLICT (user_id) DO NOTHING`,
    [input.userId, input.providerId],
  );
}

async function claimProviderWelcomeEmail(userId?: string): Promise<WelcomeRow | null> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<WelcomeRow>(
      `SELECT delivery.user_id, delivery.provider_id::text, delivery.attempt_count,
              account.email, account.name, provider.business_name
       FROM provider_welcome_email_deliveries delivery
       JOIN "user" account ON account.id=delivery.user_id
       JOIN provider_profiles provider ON provider.id=delivery.provider_id
       WHERE (delivery.status IN ('queued','failed') AND delivery.next_attempt_at <= now()
              OR delivery.status='sending' AND delivery.attempted_at < now()-interval '15 minutes')
         AND delivery.attempt_count < 5
         AND ($1::text IS NULL OR delivery.user_id=$1)
         AND provider.is_active=true
       ORDER BY delivery.next_attempt_at, delivery.queued_at
       FOR UPDATE OF delivery SKIP LOCKED
       LIMIT 1`,
      [userId ?? null],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }
    await client.query(
      `UPDATE provider_welcome_email_deliveries
       SET status='sending', attempt_count=attempt_count+1, attempted_at=now(), updated_at=now(), last_error=''
       WHERE user_id=$1`,
      [row.user_id],
    );
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deliverProviderWelcomeEmail(userId?: string) {
  const row = await claimProviderWelcomeEmail(userId);
  if (!row) return { status: "not_due" as const };

  const firstName = row.name?.trim().split(/\s+/)[0] || "there";
  const delivery = await sendTransactionalEmail({
    to: row.email,
    userId: row.user_id,
    emailType: "provider_welcome",
    idempotencyKey: `provider-welcome-${row.user_id}`,
    subject: "Set Up Your Provider Account",
    heading: `Hi ${firstName},`,
    message: `Welcome to BubsBookings! We’re excited to have you join our growing community of service providers.\n\nWith BubsBookings, you can create your own business page, list your services, manage bookings, communicate with customers, track payments, and use marketing tools like your custom link and QR code.\n\nThanks for joining us!\n\nChristian\nFounder, BubsBookings`,
    sections: [{
      heading: "Important: Set Up Your Stripe Payouts",
      message: "Before you can receive payouts from bookings, you’ll need to complete your Stripe Connect setup.",
    }],
    actions: [
      { label: "Set Up Stripe Payouts", url: "/provider/payout-setup" },
      { label: "Go to Provider Dashboard", url: "/provider/dashboard" },
    ],
  });

  if (delivery.sent) {
    await database.query(
      `UPDATE provider_welcome_email_deliveries
       SET status='sent', provider_message_id=$2, sent_at=now(), next_attempt_at=now(), last_error='', updated_at=now()
       WHERE user_id=$1 AND status='sending'`,
      [row.user_id, delivery.providerMessageId || null],
    );
    return { status: "sent" as const };
  }

  const nextAttempt = retryDelayMinutes(row.attempt_count + 1);
  const safeError = delivery.skipped
    ? "Email delivery is not configured."
    : "Resend did not accept the message. Automatic retry is scheduled.";
  await database.query(
    `UPDATE provider_welcome_email_deliveries
     SET status='failed', last_error=$2, next_attempt_at=now()+($3::int * interval '1 minute'), updated_at=now()
     WHERE user_id=$1 AND status='sending'`,
    [row.user_id, safeError, nextAttempt],
  );
  return { status: delivery.skipped ? "skipped" as const : "failed" as const };
}

export async function processProviderWelcomeEmailQueue(batchSize = 25) {
  const limit = Math.min(Math.max(batchSize, 1), 100);
  let processed = 0;
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < limit; index += 1) {
    const result = await deliverProviderWelcomeEmail();
    if (result.status === "not_due") break;
    processed += 1;
    if (result.status === "sent") sent += 1;
    else failed += 1;
  }
  return { providerWelcomeProcessed: processed, providerWelcomeSent: sent, providerWelcomeFailed: failed };
}

export async function reconcileProviderWelcomeEmailDeliveries(batchSize = 25) {
  if (!process.env.RESEND_API_KEY) return { providerWelcomeReconciled: 0, providerWelcomeDelivered: 0 };
  const pending = await database.query<{ user_id: string; provider_message_id: string }>(
    `SELECT user_id, provider_message_id
     FROM provider_welcome_email_deliveries
     WHERE status='sent' AND provider_message_id IS NOT NULL
     ORDER BY sent_at
     LIMIT $1`,
    [Math.min(Math.max(batchSize, 1), 100)],
  );
  let reconciled = 0;
  let delivered = 0;
  for (const row of pending.rows) {
    try {
      const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.provider_message_id)}`, {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      if (!response.ok) continue;
      const result = await response.json() as { last_event?: string };
      reconciled += 1;
      const lastEvent = (result.last_event || "").toLowerCase();
      if (["delivered", "opened", "clicked"].includes(lastEvent)) {
        await database.query(
          "UPDATE provider_welcome_email_deliveries SET status='delivered', delivered_at=COALESCE(delivered_at,now()), updated_at=now() WHERE user_id=$1 AND status='sent'",
          [row.user_id],
        );
        delivered += 1;
      } else if (["bounced", "complained"].includes(lastEvent)) {
        await database.query(
          "UPDATE provider_welcome_email_deliveries SET status='failed', last_error=$2, updated_at=now() WHERE user_id=$1 AND status='sent'",
          [row.user_id, lastEvent === "complained" ? "The recipient reported this message as spam." : "Resend reported that this message bounced."],
        );
      }
    } catch (error) {
      console.error("Provider welcome delivery reconciliation failed", {
        userId: row.user_id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return { providerWelcomeReconciled: reconciled, providerWelcomeDelivered: delivered };
}

export async function retryProviderWelcomeEmail(input: ProviderWelcomeInput) {
  await enqueueProviderWelcomeEmail(input);
  await database.query(
    `UPDATE provider_welcome_email_deliveries
     SET status='queued', attempt_count=0, next_attempt_at=now(), last_error='', updated_at=now()
     WHERE user_id=$1 AND status IN ('failed','queued')`,
    [input.userId],
  );
  return deliverProviderWelcomeEmail(input.userId);
}
