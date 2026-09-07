import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripeMode } from "@/lib/stripe";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const providerResult = await database.query<{ id: string }>(
    "SELECT id::text FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const providerId = providerResult.rows[0]?.id;
  if (!providerId) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const stripeMode = getStripeMode();

  const [totalsResult, monthlyResult, recentResult] = await Promise.all([
    database.query<{
      total_cents: string;
      this_month_cents: string;
      last_month_cents: string;
      paid_out_jobs: string;
      secured_cents: string;
      secured_jobs: string;
      pending_cents: string;
      pending_jobs: string;
      refunded_cents: string;
      refunded_jobs: string;
    }>(
      `SELECT
         COALESCE(SUM(GREATEST(provider_payout_cents - stripe_transfer_reversed_cents, 0)) FILTER (
           WHERE stripe_mode = $2 AND payment_release_status IN ('paid_out', 'partially_released')
         ), 0)::bigint AS total_cents,
         COALESCE(SUM(GREATEST(provider_payout_cents - stripe_transfer_reversed_cents, 0)) FILTER (
           WHERE stripe_mode = $2 AND payment_release_status IN ('paid_out', 'partially_released')
             AND payout_released_at >= date_trunc('month', CURRENT_TIMESTAMP)
         ), 0)::bigint AS this_month_cents,
         COALESCE(SUM(GREATEST(provider_payout_cents - stripe_transfer_reversed_cents, 0)) FILTER (
           WHERE stripe_mode = $2 AND payment_release_status IN ('paid_out', 'partially_released')
             AND payout_released_at >= date_trunc('month', CURRENT_TIMESTAMP) - interval '1 month'
             AND payout_released_at < date_trunc('month', CURRENT_TIMESTAMP)
         ), 0)::bigint AS last_month_cents,
         COUNT(*) FILTER (
           WHERE stripe_mode = $2 AND payment_release_status IN ('paid_out', 'partially_released')
         )::bigint AS paid_out_jobs,
         COALESCE(SUM(provider_payout_cents) FILTER (
           WHERE stripe_mode = $2 AND payment_status = 'paid' AND status = 'confirmed'
             AND payment_release_status IN ('secured', 'frozen', 'failed')
         ), 0)::bigint AS secured_cents,
         COUNT(*) FILTER (
           WHERE stripe_mode = $2 AND payment_status = 'paid' AND status = 'confirmed'
             AND payment_release_status IN ('secured', 'frozen', 'failed')
         )::bigint AS secured_jobs,
         COALESCE(SUM(provider_payout_cents) FILTER (
           WHERE stripe_mode = $2 AND payment_status = 'paid' AND status = 'completed'
             AND payment_release_status IN ('secured', 'awaiting_customer', 'processing', 'frozen', 'failed')
         ), 0)::bigint AS pending_cents,
         COUNT(*) FILTER (
           WHERE stripe_mode = $2 AND payment_status = 'paid' AND status = 'completed'
             AND payment_release_status IN ('secured', 'awaiting_customer', 'processing', 'frozen', 'failed')
         )::bigint AS pending_jobs,
         COALESCE(SUM(refunded_amount_cents) FILTER (WHERE stripe_mode = $2), 0)::bigint AS refunded_cents,
         COUNT(*) FILTER (WHERE stripe_mode = $2 AND refunded_amount_cents > 0)::bigint AS refunded_jobs
       FROM bookings
       WHERE provider_id::text = $1`,
      [providerId, stripeMode],
    ),
    database.query<{ month: string; label: string; revenue_cents: string }>(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_TIMESTAMP) - interval '5 months',
           date_trunc('month', CURRENT_TIMESTAMP),
           interval '1 month'
         ) AS month
       )
       SELECT
         to_char(months.month, 'YYYY-MM') AS month,
         to_char(months.month, 'Mon') AS label,
         COALESCE(SUM(GREATEST(bookings.provider_payout_cents - bookings.stripe_transfer_reversed_cents, 0)), 0)::bigint AS revenue_cents
       FROM months
       LEFT JOIN bookings
         ON bookings.provider_id::text = $1
        AND bookings.stripe_mode = $2
        AND bookings.payment_release_status IN ('paid_out', 'partially_released')
        AND bookings.payout_released_at >= months.month
        AND bookings.payout_released_at < months.month + interval '1 month'
       GROUP BY months.month
       ORDER BY months.month`,
      [providerId, stripeMode],
    ),
    database.query<{
      id: string;
      service: string;
      customer: string;
      payout_released_at: Date;
      provider_earnings_cents: number;
    }>(
      `SELECT b.id::text, s.title AS service, u.name AS customer, b.payout_released_at,
              GREATEST(b.provider_payout_cents - b.stripe_transfer_reversed_cents, 0)::integer AS provider_earnings_cents
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN "user" u ON u.id = b.customer_id
       WHERE b.provider_id::text = $1 AND b.stripe_mode = $2
         AND b.payment_release_status IN ('paid_out', 'partially_released')
         AND b.payout_released_at IS NOT NULL
       ORDER BY b.payout_released_at DESC
       LIMIT 5`,
      [providerId, stripeMode],
    ),
  ]);

  const totals = totalsResult.rows[0];
  return NextResponse.json({
    totalRevenue: Number(totals.total_cents) / 100,
    thisMonthRevenue: Number(totals.this_month_cents) / 100,
    lastMonthRevenue: Number(totals.last_month_cents) / 100,
    paidOutJobs: Number(totals.paid_out_jobs),
    securedEarnings: Number(totals.secured_cents) / 100,
    securedJobs: Number(totals.secured_jobs),
    pendingEarnings: Number(totals.pending_cents) / 100,
    pendingJobs: Number(totals.pending_jobs),
    refundedAmount: Number(totals.refunded_cents) / 100,
    refundedJobs: Number(totals.refunded_jobs),
    monthlyRevenue: monthlyResult.rows.map((row) => ({
      month: row.month,
      label: row.label,
      revenue: Number(row.revenue_cents) / 100,
    })),
    recentEarnings: recentResult.rows.map((row) => ({
      id: row.id,
      service: row.service,
      customer: row.customer,
      paidOutAt: row.payout_released_at,
      amount: row.provider_earnings_cents / 100,
    })),
  });
}
