import "server-only";

import { database } from "@/lib/database";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function getOrCreateConsumerStripeCustomer(input: { userId: string; email: string; name?: string | null }) {
  const mode = getStripeMode();
  const saved = await database.query<{ consumer_stripe_customer_id: string | null; consumer_stripe_mode: "test" | "live" | null }>(
    "SELECT consumer_stripe_customer_id, consumer_stripe_mode FROM user_settings WHERE user_id = $1",
    [input.userId],
  );
  const current = saved.rows[0];
  if (current?.consumer_stripe_mode === mode && current.consumer_stripe_customer_id) return current.consumer_stripe_customer_id;

  const customer = await getStripe().customers.create({
    email: input.email,
    name: input.name?.trim() || undefined,
    metadata: { userId: input.userId, purpose: "consumer_payments" },
  }, { idempotencyKey: `consumer-customer-${mode}-${input.userId}` });
  await database.query(`INSERT INTO user_settings (user_id, consumer_stripe_customer_id, consumer_stripe_mode)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET consumer_stripe_customer_id = EXCLUDED.consumer_stripe_customer_id,
      consumer_stripe_mode = EXCLUDED.consumer_stripe_mode`, [input.userId, customer.id, mode]);
  return customer.id;
}

export async function getConsumerStripeCustomer(userId: string) {
  const saved = await database.query<{ consumer_stripe_customer_id: string | null; consumer_stripe_mode: "test" | "live" | null }>(
    "SELECT consumer_stripe_customer_id, consumer_stripe_mode FROM user_settings WHERE user_id = $1",
    [userId],
  );
  const current = saved.rows[0];
  return current?.consumer_stripe_mode === getStripeMode() ? current.consumer_stripe_customer_id : null;
}
