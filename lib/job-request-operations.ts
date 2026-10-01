import "server-only";

import { database } from "./database";
import { sendTransactionalEmail } from "./email";

type QueueItem = {
  id: string;
  user_id: string;
  job_request_id: string;
  email: string;
  opportunity_notifications: boolean;
  payload: { category?: string; city?: string; state?: string; deliveryType?: "IN_PERSON" | "REMOTE" | "EITHER" };
  dedupe_key: string;
  attempts: number;
};

export async function expireStaleJobRequests() {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const expired = await client.query<{ id: string; customer_id: string; title: string }>(
      `UPDATE job_requests
       SET status = 'expired', updated_at = now()
       WHERE status IN ('open', 'receiving_responses') AND expires_at <= now()
       RETURNING id::text, customer_id, title`,
    );
    if (expired.rows.length) {
      const ids = expired.rows.map((row) => row.id);
      await client.query(
        `UPDATE quotes SET status = 'expired'
         WHERE job_request_id::text = ANY($1::text[]) AND status = 'sent'`,
        [ids],
      );
      for (const item of expired.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
           SELECT $1, 'job_request', 'Service request expired', $2, '/account/requests', $3
           WHERE COALESCE((SELECT request_notifications FROM user_settings WHERE user_id = $1), true)
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [item.customer_id, `${item.title} closed after 14 days. You can post a new request whenever you are ready.`, `job-request-expired-${item.id}`],
        );
      }
    }
    await client.query("COMMIT");
    return { expiredRequests: expired.rows.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function processJobRequestNotificationQueue(limit = 50) {
  const client = await database.connect();
  let items: QueueItem[] = [];
  try {
    await client.query("BEGIN");
    const claimed = await client.query<QueueItem>(
      `WITH ready AS (
         SELECT queue.id
         FROM job_request_notification_queue queue
         WHERE (queue.status = 'queued' AND queue.available_at <= now())
            OR (queue.status = 'processing' AND queue.processing_started_at < now() - interval '15 minutes')
         ORDER BY queue.created_at
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE job_request_notification_queue queue
       SET status = 'processing', processing_started_at = now(), attempts = queue.attempts + 1, updated_at = now()
       FROM ready, "user" account
       LEFT JOIN user_settings settings ON settings.user_id = account.id
       WHERE queue.id = ready.id AND account.id = queue.user_id
       RETURNING queue.id::text, queue.user_id, queue.job_request_id::text, account.email,
                 COALESCE(settings.opportunity_notifications, true) AS opportunity_notifications,
                 queue.payload, queue.dedupe_key, queue.attempts`,
      [Math.max(1, Math.min(limit, 100))],
    );
    items = claimed.rows;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    client.release();
    throw error;
  }
  client.release();

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of items) {
    if (!item.opportunity_notifications) {
      await database.query("UPDATE job_request_notification_queue SET status = 'skipped', updated_at = now() WHERE id::text = $1", [item.id]);
      skipped += 1;
      continue;
    }
    const place = [item.payload.city, item.payload.state].filter(Boolean).join(", ");
    const isRemote = item.payload.deliveryType === "REMOTE";
    const result = await sendTransactionalEmail({
      to: item.email,
      userId: item.user_id,
      emailType: "provider_opportunity",
      idempotencyKey: item.dedupe_key,
      subject: `New ${item.payload.category || "service"} opportunity on BubsBookings`,
      heading: isRemote ? "A customer needs remote help" : "A customer needs help in your service area",
      message: `${item.payload.category || "A service"} was requested${isRemote ? " for remote delivery" : place ? ` near ${place}` : " nearby"}. Review the request before deciding whether to message the customer or send a free quote.`,
      actionLabel: "Review opportunity",
      actionUrl: `/provider/dashboard/opportunities?requestId=${encodeURIComponent(item.job_request_id)}`,
    });
    if (result.sent || result.skipped) {
      await database.query("UPDATE job_request_notification_queue SET status = $2, sent_at = CASE WHEN $2 = 'sent' THEN now() END, updated_at = now(), last_error = NULL WHERE id::text = $1", [item.id, result.sent ? "sent" : "skipped"]);
      if (result.sent) sent += 1; else skipped += 1;
    } else {
      const terminal = item.attempts >= 5;
      await database.query(
        `UPDATE job_request_notification_queue
         SET status = $2, available_at = now() + make_interval(mins => LEAST(60, attempts * 5)),
             last_error = 'Email delivery failed', updated_at = now()
         WHERE id::text = $1`,
        [item.id, terminal ? "failed" : "queued"],
      );
      failed += 1;
    }
  }
  return { requestEmailsClaimed: items.length, requestEmailsSent: sent, requestEmailsSkipped: skipped, requestEmailsFailed: failed };
}
