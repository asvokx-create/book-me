import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

type WeeklyTrend = {
  week_start: Date;
  visitors: number;
  customer_registrations: number;
  provider_signups: number;
  booking_requests: number;
  completed_bookings: number;
  referral_visits: number;
};

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="rounded-2xl border border-[#183126]/10 bg-white p-5 shadow-[0_6px_20px_rgba(24,49,38,.04)]">
    <p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">{label}</p>
    <p className="mt-3 text-3xl font-bold tracking-[-.04em]">{typeof value === "number" ? value.toLocaleString() : value}</p>
    <p className="mt-2 text-xs leading-5 text-[#718078]">{detail}</p>
  </article>;
}

export default async function AdminGrowthPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/growth");

  const [summaryResult, trendsResult, focusMarketsResult] = await Promise.all([
    database.query<{
      registered_providers: number;
      active_listings: number;
      new_customers: number;
      public_visitors: number;
      booking_customers: number;
      completed_bookings: number;
      referral_visits: number;
      provider_join_visitors: number;
      provider_signups: number;
    }>(`
      WITH known_visitors AS (
        SELECT anonymous_id, max(user_id) AS user_id
        FROM analytics_events
        WHERE anonymous_id IS NOT NULL AND user_id IS NOT NULL
        GROUP BY anonymous_id
      ), public_visits AS (
        SELECT DISTINCT COALESCE(NULLIF(event.user_id, ''), known.user_id, NULLIF(event.anonymous_id, '')) AS visitor
        FROM analytics_events event
        LEFT JOIN known_visitors known ON known.anonymous_id = event.anonymous_id
        WHERE event.event_name = 'page_view'
          AND event.created_at >= now() - interval '30 days'
          AND event.path !~ '^/(admin|account|affiliate|provider/dashboard)(/|\\?|$)'
      ), provider_join_visits AS (
        SELECT DISTINCT COALESCE(NULLIF(event.user_id, ''), known.user_id, NULLIF(event.anonymous_id, '')) AS visitor
        FROM analytics_events event
        LEFT JOIN known_visitors known ON known.anonymous_id = event.anonymous_id
        WHERE event.event_name = 'page_view'
          AND event.created_at >= now() - interval '30 days'
          AND event.path ~ '^/providers/join(\\?|$)'
      )
      SELECT
        (SELECT count(*)::int FROM provider_profiles) AS registered_providers,
        (SELECT count(*)::int
         FROM services service
         JOIN provider_profiles provider ON provider.id = service.provider_id
         JOIN provider_companies company ON company.id = service.company_id
         WHERE service.is_active = true AND provider.is_active = true
           AND provider.age_verification_status = 'verified' AND company.is_active = true) AS active_listings,
        (SELECT count(*)::int FROM "user" account
         WHERE account."createdAt" >= now() - interval '30 days'
           AND NOT EXISTS (SELECT 1 FROM provider_profiles provider WHERE provider.user_id = account.id)) AS new_customers,
        (SELECT count(*)::int FROM public_visits WHERE visitor IS NOT NULL) AS public_visitors,
        (SELECT count(DISTINCT customer_id)::int FROM bookings WHERE created_at >= now() - interval '30 days') AS booking_customers,
        (SELECT count(*)::int FROM bookings WHERE completed_at >= now() - interval '30 days' AND status = 'completed') AS completed_bookings,
        (SELECT count(*)::int FROM affiliate_clicks WHERE created_at >= now() - interval '30 days') AS referral_visits,
        (SELECT count(*)::int FROM provider_join_visits WHERE visitor IS NOT NULL) AS provider_join_visitors,
        (SELECT count(*)::int FROM provider_profiles WHERE created_at >= now() - interval '30 days') AS provider_signups
    `),
    database.query<WeeklyTrend>(`
      WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', now()) - interval '7 weeks',
          date_trunc('week', now()),
          interval '1 week'
        ) AS week_start
      ), known_visitors AS (
        SELECT anonymous_id, max(user_id) AS user_id
        FROM analytics_events
        WHERE anonymous_id IS NOT NULL AND user_id IS NOT NULL
        GROUP BY anonymous_id
      ), public_events AS (
        SELECT event.created_at, COALESCE(NULLIF(event.user_id, ''), known.user_id, NULLIF(event.anonymous_id, '')) AS visitor
        FROM analytics_events event
        LEFT JOIN known_visitors known ON known.anonymous_id = event.anonymous_id
        WHERE event.event_name = 'page_view'
          AND event.path !~ '^/(admin|account|affiliate|provider/dashboard)(/|\\?|$)'
      )
      SELECT weeks.week_start,
        (SELECT count(DISTINCT visitor)::int FROM public_events event
         WHERE event.visitor IS NOT NULL AND event.created_at >= weeks.week_start AND event.created_at < weeks.week_start + interval '1 week') AS visitors,
        (SELECT count(*)::int FROM "user" account
         WHERE account."createdAt" >= weeks.week_start AND account."createdAt" < weeks.week_start + interval '1 week'
           AND NOT EXISTS (SELECT 1 FROM provider_profiles provider WHERE provider.user_id = account.id)) AS customer_registrations,
        (SELECT count(*)::int FROM provider_profiles provider
         WHERE provider.created_at >= weeks.week_start AND provider.created_at < weeks.week_start + interval '1 week') AS provider_signups,
        (SELECT count(*)::int FROM bookings booking
         WHERE booking.created_at >= weeks.week_start AND booking.created_at < weeks.week_start + interval '1 week') AS booking_requests,
        (SELECT count(*)::int FROM bookings booking
         WHERE booking.completed_at >= weeks.week_start AND booking.completed_at < weeks.week_start + interval '1 week' AND booking.status = 'completed') AS completed_bookings,
        (SELECT count(*)::int FROM affiliate_clicks click
         WHERE click.created_at >= weeks.week_start AND click.created_at < weeks.week_start + interval '1 week') AS referral_visits
      FROM weeks
      ORDER BY weeks.week_start DESC
    `),
    database.query<{ city: string; active_providers: number; active_listings: number }>(`
      SELECT location.city,
        count(DISTINCT service.provider_id)::int AS active_providers,
        count(DISTINCT service.id)::int AS active_listings
      FROM provider_locations location
      JOIN services service ON service.location_id = location.id AND service.is_active = true
      JOIN provider_profiles provider ON provider.id = service.provider_id
        AND provider.is_active = true AND provider.age_verification_status = 'verified'
      JOIN provider_companies company ON company.id = service.company_id AND company.is_active = true
      WHERE location.is_active = true
        AND lower(location.city) = ANY(ARRAY['issaquah', 'sammamish', 'bellevue'])
      GROUP BY location.city
      ORDER BY location.city
    `),
  ]);

  const summary = summaryResult.rows[0] ?? {
    registered_providers: 0, active_listings: 0, new_customers: 0, public_visitors: 0,
    booking_customers: 0, completed_bookings: 0, referral_visits: 0, provider_join_visitors: 0, provider_signups: 0,
  };
  const bookingConversion = percent(summary.booking_customers, summary.public_visitors);
  const providerSignupConversion = percent(summary.provider_signups, summary.provider_join_visitors);
  const focusMarkets = new Map(focusMarketsResult.rows.map((row) => [row.city.toLowerCase(), row]));

  return <main className="min-h-screen overflow-x-clip bg-[#f4f4ef] px-4 py-7 text-[#183126] sm:px-8 sm:py-8">
    <div className="mx-auto min-w-0 max-w-6xl">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin growth</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Acquisition dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#687970]">A privacy-conscious view of marketplace growth using first-party, consented BubsBookings activity and completed marketplace records.</p>
        </div>
        <BackButton label="Back to admin" fallbackHref="/admin" />
      </div>

      <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-[#183126] p-5 text-white sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 className="text-xl font-bold">Measurement sources</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#c5d3cb]">Visit and conversion figures below are calculated from BubsBookings&apos; first-party analytics events and marketplace records. Privatus Analytics remains the separate source for its engagement and performance reports; this page does not access or expose Privatus credentials.</p></div>
          <Link href="/admin/operations" className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10">Open Operations</Link>
        </div>
      </section>

      <section className="mt-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Marketplace snapshot</h2><p className="mt-1 text-sm text-[#718078]">All-time supply, with acquisition and booking activity for the last 30 days.</p></div></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Registered providers" value={summary.registered_providers} detail="Provider profiles created · all time" />
          <Metric label="Published listings" value={summary.active_listings} detail="Active, public, age-eligible listings · now" />
          <Metric label="New customers" value={summary.new_customers} detail="New non-provider accounts · last 30 days" />
          <Metric label="Website visits" value={summary.public_visitors} detail="Unique first-party public visitors · last 30 days" />
          <Metric label="Booking conversion" value={`${bookingConversion}%`} detail="Unique booking customers ÷ public visitors · last 30 days" />
          <Metric label="Completed bookings" value={summary.completed_bookings} detail="Bookings completed · last 30 days" />
          <Metric label="Referral traffic" value={summary.referral_visits} detail="Recorded active Partner referral clicks · last 30 days" />
          <Metric label="Provider signup conversion" value={`${providerSignupConversion}%`} detail="Provider profiles created ÷ provider-join visitors · last 30 days" />
        </div>
      </section>

      <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-bold">Growth trend</h2><p className="mt-1 text-sm text-[#718078]">Weekly activity over the last eight weeks. Counts represent events in each week, not cumulative totals.</p></div><Link href="/admin/affiliates" className="text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">Review partner attribution →</Link></div>
        <div className="admin-table-scroll mt-5 max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-[#183126]/10" role="region" aria-label="Weekly growth trend" tabIndex={0}><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f5f5ef] text-xs uppercase tracking-[.1em] text-[#718078]"><tr><th className="px-4 py-3">Week of</th><th className="px-4 py-3 text-right">Visitors</th><th className="px-4 py-3 text-right">Customers</th><th className="px-4 py-3 text-right">Providers</th><th className="px-4 py-3 text-right">Booking requests</th><th className="px-4 py-3 text-right">Completed</th><th className="px-4 py-3 text-right">Referral visits</th></tr></thead><tbody className="divide-y divide-[#183126]/10">{trendsResult.rows.map((row) => <tr key={row.week_start.toISOString()}><td className="px-4 py-3 font-bold">{row.week_start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td><td className="px-4 py-3 text-right">{row.visitors.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.customer_registrations.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.provider_signups.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.booking_requests.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.completed_bookings.toLocaleString()}</td><td className="px-4 py-3 text-right">{row.referral_visits.toLocaleString()}</td></tr>)}</tbody></table></div>
      </section>

      <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><h2 className="text-2xl font-bold">Initial market coverage</h2><p className="mt-1 text-sm leading-6 text-[#718078]">Current public supply in the first three growth markets. This is an internal recruiting signal, not a customer-facing availability claim.</p><div className="mt-5 grid gap-4 md:grid-cols-3">{["Issaquah", "Sammamish", "Bellevue"].map((city) => { const market = focusMarkets.get(city.toLowerCase()); return <article key={city} className="rounded-2xl bg-[#f5f5ef] p-5"><p className="text-xs font-bold uppercase tracking-[.13em] text-[#718078]">{city}, WA</p><p className="mt-3 text-2xl font-bold">{market?.active_providers ?? 0} providers</p><p className="mt-1 text-sm text-[#617169]">{market?.active_listings ?? 0} active listings</p><Link href={`/locations/${city.toLowerCase()}`} className="mt-4 inline-block text-sm font-bold underline decoration-[#c8bc43] decoration-2 underline-offset-4">View local page →</Link></article>; })}</div></section>

      <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-[#fff9d8] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Provider outreach CRM</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#687052]">Research public business information, prevent duplicate outreach, maintain permanent opt-outs, and create human-reviewed drafts. It never sends outreach automatically.</p></div><Link href="/admin/growth/outreach" className="shrink-0 rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Open outreach CRM</Link></div></section>
      <section className="mt-5 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold">Social content</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#687052]">Create editable, copy-only social posts from real active local listings. Nothing is published automatically.</p></div><Link href="/admin/growth/content" className="shrink-0 rounded-full border border-[#183126]/15 px-5 py-3 text-sm font-bold">Open content studio</Link></div></section>
      <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7"><h2 className="text-xl font-bold">Measurement limits</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#687052]">The dashboard does not merge anonymous visitors with people unless a first-party event has already linked them, estimate revenue, or infer a person&apos;s marketing source. Affiliate referral totals use the existing first-party attribution system. General UTM campaign attribution is a later phase.</p></section>
    </div>
  </main>;
}
