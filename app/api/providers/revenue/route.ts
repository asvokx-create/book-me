import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripeMode } from "@/lib/stripe";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const providerResult = await database.query<{ id: string; plan: ProviderPlan }>(
    "SELECT id::text,plan FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const providerId = providerResult.rows[0]?.id;
  if (!providerId) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const stripeMode = getStripeMode();

  const [totalsResult, monthlyResult, recentResult, repeatResult, hourlyResult, tipsResult] = await Promise.all([
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
    database.query<{customer_count:number;repeat_customer_count:number;repeat_booking_count:number;completed_booking_count:number;returning_revenue_cents:string}>(`WITH ordered AS (
        SELECT customer_id,price_cents,refunded_amount_cents,
          row_number() OVER(PARTITION BY customer_id ORDER BY starts_at,created_at) AS customer_booking_number
        FROM bookings WHERE provider_id::text=$1 AND status='completed'
      ) SELECT count(DISTINCT customer_id)::int AS customer_count,
        count(DISTINCT customer_id) FILTER(WHERE customer_booking_number>1)::int AS repeat_customer_count,
        count(*) FILTER(WHERE customer_booking_number>1)::int AS repeat_booking_count,
        count(*)::int AS completed_booking_count,
        COALESCE(sum(price_cents-refunded_amount_cents) FILTER(WHERE customer_booking_number>1),0)::bigint AS returning_revenue_cents
      FROM ordered`,[providerId]),
    database.query<{ hourly_bookings: number; booked_minutes: string; average_minutes: number | null; hourly_revenue_cents: string }>(
      `SELECT count(*)::int AS hourly_bookings,COALESCE(sum(billable_duration_minutes),0)::bigint AS booked_minutes,
              round(avg(billable_duration_minutes))::integer AS average_minutes,
              COALESCE(sum(price_cents-refunded_amount_cents),0)::bigint AS hourly_revenue_cents
       FROM bookings WHERE provider_id::text=$1 AND pricing_type_snapshot='HOURLY' AND status IN ('confirmed','completed')`, [providerId]),
    database.query<{ total_cents: string; this_month_cents: string; tip_count: string; average_cents: string }>(
      `SELECT COALESCE(sum(GREATEST(amount_cents-refunded_amount_cents,0)) FILTER (WHERE transfer_status IN ('paid_out','partially_reversed')),0)::bigint AS total_cents,
        COALESCE(sum(GREATEST(amount_cents-refunded_amount_cents,0)) FILTER (WHERE transfer_status IN ('paid_out','partially_reversed') AND transferred_at>=date_trunc('month',CURRENT_TIMESTAMP)),0)::bigint AS this_month_cents,
        count(*) FILTER (WHERE transfer_status IN ('paid_out','partially_reversed'))::bigint AS tip_count,
        COALESCE(round(avg(GREATEST(amount_cents-refunded_amount_cents,0)) FILTER (WHERE transfer_status IN ('paid_out','partially_reversed'))),0)::bigint AS average_cents
       FROM booking_tips WHERE provider_id::text=$1 AND stripe_mode=$2`, [providerId, stripeMode]),
  ]);

  const totals = totalsResult.rows[0];
  const repeat=repeatResult.rows[0];
  const repeatAllowed=PLAN_ENTITLEMENTS[providerResult.rows[0].plan].repeatCustomerTools;
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
    repeatMetrics: repeatAllowed?{
      customers:repeat.customer_count,
      repeatCustomers:repeat.repeat_customer_count,
      repeatBookings:repeat.repeat_booking_count,
      repeatBookingRate:repeat.completed_booking_count?Math.round(repeat.repeat_booking_count/repeat.completed_booking_count*100):0,
      returningRevenue:Number(repeat.returning_revenue_cents)/100,
    }:null,
    hourlyMetrics: {
      bookings: hourlyResult.rows[0]?.hourly_bookings ?? 0,
      bookedHours: Number(hourlyResult.rows[0]?.booked_minutes ?? 0) / 60,
      averageDurationMinutes: hourlyResult.rows[0]?.average_minutes ?? null,
      serviceRevenue: Number(hourlyResult.rows[0]?.hourly_revenue_cents ?? 0) / 100,
    },
    tipMetrics: {
      total: Number(tipsResult.rows[0]?.total_cents ?? 0) / 100,
      thisMonth: Number(tipsResult.rows[0]?.this_month_cents ?? 0) / 100,
      count: Number(tipsResult.rows[0]?.tip_count ?? 0),
      average: Number(tipsResult.rows[0]?.average_cents ?? 0) / 100,
    },
  });
}
