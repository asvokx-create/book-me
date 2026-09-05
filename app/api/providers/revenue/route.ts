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
      completed_jobs: string;
    }>(
      `SELECT
         COALESCE(SUM(price_cents) FILTER (WHERE payment_status = 'paid' AND stripe_mode = $2), 0)::bigint AS total_cents,
         COALESCE(SUM(price_cents) FILTER (
           WHERE payment_status = 'paid' AND stripe_mode = $2
             AND paid_at >= date_trunc('month', CURRENT_TIMESTAMP)
         ), 0)::bigint AS this_month_cents,
         COALESCE(SUM(price_cents) FILTER (
           WHERE payment_status = 'paid' AND stripe_mode = $2
             AND paid_at >= date_trunc('month', CURRENT_TIMESTAMP) - interval '1 month'
             AND paid_at < date_trunc('month', CURRENT_TIMESTAMP)
         ), 0)::bigint AS last_month_cents,
         COUNT(*) FILTER (WHERE payment_status = 'paid' AND stripe_mode = $2)::bigint AS completed_jobs
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
         COALESCE(SUM(bookings.price_cents), 0)::bigint AS revenue_cents
       FROM months
       LEFT JOIN bookings
         ON bookings.provider_id::text = $1
        AND bookings.payment_status = 'paid'
        AND bookings.stripe_mode = $2
        AND bookings.paid_at >= months.month
        AND bookings.paid_at < months.month + interval '1 month'
       GROUP BY months.month
       ORDER BY months.month`,
      [providerId, stripeMode],
    ),
    database.query<{
      id: string;
      service: string;
      customer: string;
      starts_at: Date;
      price_cents: number;
    }>(
      `SELECT b.id::text, s.title AS service, u.name AS customer, b.starts_at, b.price_cents
       FROM bookings b
       JOIN services s ON s.id = b.service_id
       JOIN "user" u ON u.id = b.customer_id
       WHERE b.provider_id::text = $1 AND b.payment_status = 'paid' AND b.stripe_mode = $2
       ORDER BY b.paid_at DESC
       LIMIT 5`,
      [providerId, stripeMode],
    ),
  ]);

  const totals = totalsResult.rows[0];
  return NextResponse.json({
    totalRevenue: Number(totals.total_cents) / 100,
    thisMonthRevenue: Number(totals.this_month_cents) / 100,
    lastMonthRevenue: Number(totals.last_month_cents) / 100,
    completedJobs: Number(totals.completed_jobs),
    monthlyRevenue: monthlyResult.rows.map((row) => ({
      month: row.month,
      label: row.label,
      revenue: Number(row.revenue_cents) / 100,
    })),
    recentEarnings: recentResult.rows.map((row) => ({
      id: row.id,
      service: row.service,
      customer: row.customer,
      completedAt: row.starts_at,
      amount: row.price_cents / 100,
    })),
  });
}
