import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/operations");
  const [emails, checks, activity, funnel, refunds, unmetDemand, zeroResultDemand, providerFunnel, marketplaceSupply, marketplaceEconomics] = await Promise.all([
    database.query<{ status: string; count: number }>("SELECT status, count(*)::int AS count FROM email_delivery_log WHERE created_at >= now() - interval '7 days' GROUP BY status"),
    database.query<{ id: string; check_type: string; status: string; created_at: Date }>("SELECT id::text, check_type, status, created_at FROM operations_checks ORDER BY created_at DESC LIMIT 20"),
    database.query<{ id: string; action: string; target_type: string; target_id: string | null; created_at: Date; user_name: string | null }>(`SELECT log.id::text, log.action, log.target_type, log.target_id, log.created_at, u.name AS user_name FROM activity_log log LEFT JOIN "user" u ON u.id = log.user_id ORDER BY log.created_at DESC LIMIT 30`),
    database.query<{ event_name: string; count: number }>(`SELECT event_name, count(*)::int AS count FROM analytics_events WHERE created_at >= now() - interval '30 days' GROUP BY event_name`),
    database.query<{ status: string; count: number }>(`SELECT refund_status AS status, count(*)::int AS count FROM bookings WHERE refund_status <> 'none' GROUP BY refund_status`),
    database.query<{ location: string; category: string | null; requests: number; latest_request: Date }>(
      `SELECT location, category, count(*)::int AS requests, max(created_at) AS latest_request
       FROM service_demand_requests
       WHERE created_at >= now() - interval '30 days'
       GROUP BY location, category
       ORDER BY requests DESC, latest_request DESC
       LIMIT 12`,
    ),
    database.query<{ location: string; category: string; search_term: string; radius_miles: number; searches: number; latest_search: Date }>(
      `SELECT COALESCE(NULLIF(metadata->>'location', ''), 'Location not set') AS location,
              COALESCE(NULLIF(metadata->>'category', ''), 'All services') AS category,
              COALESCE(NULLIF(metadata->>'query', ''), 'Category browse') AS search_term,
              COALESCE((metadata->>'radiusMiles')::int, 25) AS radius_miles,
              count(*)::int AS searches,
              max(created_at) AS latest_search
       FROM analytics_events
       WHERE event_name = 'zero_result_search'
         AND created_at >= now() - interval '30 days'
       GROUP BY 1, 2, 3, 4
       ORDER BY searches DESC, latest_search DESC
       LIMIT 20`,
    ),
    database.query<{ signups: number; first_listings: number; first_bookings: number; avg_hours_to_listing: number | null; avg_hours_to_booking: number | null }>(
      `SELECT count(*)::int AS signups,
              count(first_service.created_at)::int AS first_listings,
              count(first_booking.created_at)::int AS first_bookings,
              avg(EXTRACT(EPOCH FROM (first_service.created_at - provider.created_at)) / 3600)::float AS avg_hours_to_listing,
              avg(EXTRACT(EPOCH FROM (first_booking.created_at - provider.created_at)) / 3600)::float AS avg_hours_to_booking
       FROM provider_profiles provider
       LEFT JOIN LATERAL (SELECT min(created_at) AS created_at FROM services WHERE provider_id = provider.id) first_service ON true
       LEFT JOIN LATERAL (SELECT min(created_at) AS created_at FROM bookings WHERE provider_id = provider.id) first_booking ON true
       WHERE provider.created_at >= now() - interval '30 days'`,
    ),
    database.query<{ city: string; state: string; category: string; active_providers: number; active_listings: number }>(
      `SELECT provider.city, provider.state, service.category,
              count(DISTINCT provider.id)::int AS active_providers,
              count(service.id)::int AS active_listings
       FROM provider_profiles provider
       JOIN services service ON service.provider_id = provider.id AND service.is_active = true
       WHERE provider.is_active = true
       GROUP BY provider.city, provider.state, service.category
       ORDER BY active_listings DESC, active_providers DESC, provider.city, service.category
       LIMIT 20`,
    ),
    database.query<{ paid_bookings: number; completed_bookings: number; gross_booking_value_cents: number; active_providers: number; repeat_customers: number; paying_customers: number; inactive_providers: number }>(
      `SELECT
         count(*) FILTER (WHERE booking.payment_status IN ('paid', 'refunded'))::int AS paid_bookings,
         count(*) FILTER (WHERE booking.status = 'completed')::int AS completed_bookings,
         COALESCE(sum(booking.price_cents) FILTER (WHERE booking.payment_status IN ('paid', 'refunded')), 0)::bigint AS gross_booking_value_cents,
         count(DISTINCT booking.provider_id) FILTER (WHERE booking.payment_status IN ('paid', 'refunded'))::int AS active_providers,
         count(DISTINCT booking.customer_id) FILTER (WHERE booking.customer_id IN (SELECT customer_id FROM bookings WHERE payment_status IN ('paid', 'refunded') GROUP BY customer_id HAVING count(*) > 1))::int AS repeat_customers,
         count(DISTINCT booking.customer_id) FILTER (WHERE booking.payment_status IN ('paid', 'refunded'))::int AS paying_customers,
         (SELECT count(*)::int FROM provider_profiles provider WHERE provider.is_active = true AND NOT EXISTS (SELECT 1 FROM bookings recent WHERE recent.provider_id = provider.id AND recent.created_at >= now() - interval '60 days')) AS inactive_providers
       FROM bookings booking`,
    ),
  ]);
  const totals = Object.fromEntries(emails.rows.map((row) => [row.status, row.count]));
  const events = Object.fromEntries(funnel.rows.map((row) => [row.event_name, row.count]));
  const refundTotals = Object.fromEntries(refunds.rows.map((row) => [row.status, row.count]));
  const providerMetrics = providerFunnel.rows[0] ?? { signups: 0, first_listings: 0, first_bookings: 0, avg_hours_to_listing: null, avg_hours_to_booking: null };
  const economics = marketplaceEconomics.rows[0] ?? { paid_bookings: 0, completed_bookings: 0, gross_booking_value_cents: 0, active_providers: 0, repeat_customers: 0, paying_customers: 0, inactive_providers: 0 };
  const searchToViewRate = percent(events.service_view ?? 0, (events.search_results ?? 0) + (events.zero_result_search ?? 0));
  const viewToMessageRate = percent(events.message_sent ?? 0, events.service_view ?? 0);
  const bookingToPaymentRate = percent(events.payment_completed ?? 0, events.booking_requested ?? 0);
  const signupToListingRate = percent(providerMetrics.first_listings, providerMetrics.signups);
  const signupToBookingRate = percent(providerMetrics.first_bookings, providerMetrics.signups);
  const revenuePerActiveProvider = economics.active_providers > 0 ? economics.gross_booking_value_cents / economics.active_providers : 0;

  return <main className="min-h-screen bg-[#f4f4ef] px-5 py-8 text-[#183126] sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin operations</p><h1 className="mt-2 text-3xl font-bold">Reliability center</h1></div><Link href="/admin" className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">← Admin console</Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Database" value="Connected" good /><Card label="Email" value={isEmailConfigured() ? "Configured" : "Needs setup"} good={isEmailConfigured()} /><Card label="Emails sent · 7d" value={String(totals.sent ?? 0)} good /><Card label="Email failures · 7d" value={String(totals.failed ?? 0)} good={!totals.failed} /></div>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">30-day marketplace conversion</h2><p className="mt-1 text-sm text-[#718078]">Use the rates—not feature count—to find the largest customer and provider drop-offs.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniMetric label="Searches" value={events.search_results ?? 0} /><MiniMetric label="Zero-result searches" value={events.zero_result_search ?? 0} /><MiniMetric label="Listing views" value={events.service_view ?? 0} detail={`${searchToViewRate}% of searches`} /><MiniMetric label="Messages" value={events.message_sent ?? 0} detail={`${viewToMessageRate}% of views`} /><MiniMetric label="Booking requests" value={events.booking_requested ?? 0} /><MiniMetric label="Checkout starts" value={events.checkout_started ?? 0} /><MiniMetric label="Payments" value={events.payment_completed ?? 0} detail={`${bookingToPaymentRate}% of requests`} /><MiniMetric label="Demand alerts" value={events.service_demand_captured ?? 0} /></div><div className="mt-4 rounded-2xl bg-[#f5f5ef] p-4 text-sm"><strong>Refund queue:</strong> {refundTotals.requested ?? 0} awaiting review · {refundTotals.refunded ?? 0} completed</div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">30-day provider activation</h2><p className="mt-1 text-sm text-[#718078]">From provider profile creation to first listing and first booking.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniMetric label="Provider signups" value={providerMetrics.signups} /><MiniMetric label="Published a listing" value={providerMetrics.first_listings} detail={`${signupToListingRate}% of signups`} /><MiniMetric label="Received a booking" value={providerMetrics.first_bookings} detail={`${signupToBookingRate}% of signups`} /><MiniMetric label="Inactive providers" value={economics.inactive_providers} detail="No booking in 60 days" /></div><p className="mt-4 text-sm text-[#617169]">Average time to first listing: <strong>{formatHours(providerMetrics.avg_hours_to_listing)}</strong> · Average time to first booking: <strong>{formatHours(providerMetrics.avg_hours_to_booking)}</strong></p></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Marketplace economics</h2><p className="mt-1 text-sm text-[#718078]">All-time paid activity currently recorded by the marketplace.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniMetric label="Paid bookings" value={economics.paid_bookings} /><MiniMetric label="Completed bookings" value={economics.completed_bookings} /><MiniMetric label="Gross booking value" value={`$${(Number(economics.gross_booking_value_cents) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} /><MiniMetric label="GBV per active provider" value={`$${(Number(revenuePerActiveProvider) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} /><MiniMetric label="Repeat customers" value={economics.repeat_customers} detail={`${percent(economics.repeat_customers, economics.paying_customers)}% of paying customers`} /></div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Unmet service demand</h2><p className="mt-1 text-sm text-[#718078]">Consented requests from searches with no matching listings in the last 30 days. Use these locations and categories to guide provider recruiting.</p><div className="mt-5 divide-y divide-[#183126]/10">{unmetDemand.rows.map((row) => <div key={`${row.location}-${row.category ?? "any"}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{row.category || "Any service"}</p><p className="mt-1 text-xs text-[#718078]">{row.location} · Latest {row.latest_request.toLocaleDateString()}</p></div><span className="rounded-full bg-[#e4f1e5] px-3 py-1 text-xs font-bold text-[#35704a]">{row.requests} {row.requests === 1 ? "request" : "requests"}</span></div>)}{unmetDemand.rows.length === 0 && <p className="py-8 text-center text-sm text-[#718078]">No unmet-demand requests in the last 30 days.</p>}</div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Zero-result search gaps</h2><p className="mt-1 text-sm text-[#718078]">Every search that returned no listings, grouped by city, radius, category, and search term. Recruit into the highest-frequency gaps first.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[#183126]/15 text-xs uppercase tracking-wider text-[#718078]"><th className="px-3 py-3">Market</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Search term</th><th className="px-3 py-3">Radius</th><th className="px-3 py-3 text-right">Searches</th></tr></thead><tbody className="divide-y divide-[#183126]/10">{zeroResultDemand.rows.map((row) => <tr key={`${row.location}-${row.category}-${row.search_term}-${row.radius_miles}`}><td className="px-3 py-3 font-bold">{row.location}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3">{row.search_term}</td><td className="px-3 py-3">{row.radius_miles} mi</td><td className="px-3 py-3 text-right font-bold">{row.searches}</td></tr>)}{zeroResultDemand.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#718078]">No zero-result searches have been recorded in the last 30 days.</td></tr>}</tbody></table></div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Supply density by market</h2><p className="mt-1 text-sm text-[#718078]">Concentrate recruiting in one metro until core categories offer real customer choice. Aim for 5–10 useful providers in each priority category.</p><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-[#183126]/15 text-xs uppercase tracking-wider text-[#718078]"><th className="px-3 py-3">Market</th><th className="px-3 py-3">Category</th><th className="px-3 py-3 text-right">Providers</th><th className="px-3 py-3 text-right">Listings</th><th className="px-3 py-3">Density</th></tr></thead><tbody className="divide-y divide-[#183126]/10">{marketplaceSupply.rows.map((row) => <tr key={`${row.city}-${row.state}-${row.category}`}><td className="px-3 py-3 font-bold">{row.city}, {row.state}</td><td className="px-3 py-3">{row.category}</td><td className="px-3 py-3 text-right">{row.active_providers}</td><td className="px-3 py-3 text-right">{row.active_listings}</td><td className="px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${row.active_providers >= 5 ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#fff3c7] text-[#78681f]"}`}>{row.active_providers >= 5 ? "Ready for demand" : `Recruit ${5 - row.active_providers}+`}</span></td></tr>)}{marketplaceSupply.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#718078]">No active supply is available yet.</td></tr>}</tbody></table></div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Automated checks</h2><p className="mt-1 text-sm text-[#718078]">Scheduled jobs record each successful run here.</p><div className="mt-5 divide-y divide-[#183126]/10">{checks.rows.map((check) => <div key={check.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{check.check_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#718078]">{check.created_at.toLocaleString()}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${check.status === "ok" ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#fff0e8] text-[#964f2c]"}`}>{check.status}</span></div>)}{checks.rows.length === 0 && <p className="py-8 text-center text-sm text-[#718078]">No scheduled checks have run yet.</p>}</div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Recent account activity</h2><p className="mt-1 text-sm text-[#718078]">Security-sensitive booking, payment, messaging, and report actions.</p><div className="mt-5 divide-y divide-[#183126]/10">{activity.rows.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{entry.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#718078]">{entry.user_name ?? "Unknown account"} · {entry.target_type}{entry.target_id ? ` ${entry.target_id.slice(0, 8)}` : ""}</p></div><time className="text-xs font-semibold text-[#718078]">{entry.created_at.toLocaleString()}</time></div>)}{activity.rows.length === 0 && <p className="py-8 text-center text-sm text-[#718078]">No recorded activity yet.</p>}</div></section>
    <section className="mt-6 rounded-[2rem] bg-[#183126] p-6 text-white"><h2 className="text-xl font-bold">Production checklist</h2><ul className="mt-4 space-y-3 text-sm text-[#c4d0ca]"><li>✓ Public health endpoint at <code>/api/health</code></li><li>✓ Email delivery, Stripe webhooks, refunds, and audit logs</li><li>✓ 30-day search-to-payment analytics</li><li>✓ Scheduled booking reminders and payment-release checks</li><li>✓ External uptime monitor connected</li><li>○ Enable automatic backups on the DigitalOcean managed database</li><li>○ Configure failed-deployment alerts</li><li>○ Perform a monthly backup restore test</li></ul></section>
  </div></main>;
}

function Card({ label, value, good }: { label: string; value: string; good: boolean }) { return <div className="rounded-2xl border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-3 text-xl font-bold">{value}</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${good ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#fff0e8] text-[#964f2c]"}`}>{good ? "Healthy" : "Action needed"}</span></div>; }
function MiniMetric({ label, value, detail }: { label: string; value: number | string; detail?: string }) { return <div className="rounded-2xl bg-[#f5f5ef] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-2 text-2xl font-bold">{typeof value === "number" ? value.toLocaleString() : value}</p>{detail && <p className="mt-1 text-xs font-semibold text-[#718078]">{detail}</p>}</div>; }

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatHours(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) return "Not enough data";
  const hours = Number(value);
  return hours < 48 ? `${hours.toFixed(1)} hours` : `${(hours / 24).toFixed(1)} days`;
}
