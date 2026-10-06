import "server-only";

import { database } from "@/lib/database";

export async function getAdminFinancialSummary() {
  const result = await database.query<{ platform_revenue_cents: string | number }>(`
    SELECT COALESCE(SUM(
      GREATEST(0, b.platform_fee_cents - COALESCE(
        ROUND(b.platform_fee_cents::numeric * LEAST(b.refunded_amount_cents, b.price_cents) / NULLIF(b.price_cents, 0)),
        0
      )::bigint)
      + GREATEST(0, b.customer_service_fee_cents - b.customer_service_fee_refunded_cents)
    ), 0)::bigint AS platform_revenue_cents
    FROM bookings b
    WHERE b.payment_status IN ('paid', 'refunded')
      AND b.payment_release_status <> 'not_applicable'
  `);

  return { platformRevenueCents: Number(result.rows[0]?.platform_revenue_cents ?? 0) };
}
