import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { isEmailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/operations");
  const [emails, checks, activity, funnel, refunds] = await Promise.all([
    database.query<{ status: string; count: number }>("SELECT status, count(*)::int AS count FROM email_delivery_log WHERE created_at >= now() - interval '7 days' GROUP BY status"),
    database.query<{ id: string; check_type: string; status: string; created_at: Date }>("SELECT id::text, check_type, status, created_at FROM operations_checks ORDER BY created_at DESC LIMIT 20"),
    database.query<{ id: string; action: string; target_type: string; target_id: string | null; created_at: Date; user_name: string | null }>(`SELECT log.id::text, log.action, log.target_type, log.target_id, log.created_at, u.name AS user_name FROM activity_log log LEFT JOIN "user" u ON u.id = log.user_id ORDER BY log.created_at DESC LIMIT 30`),
    database.query<{ event_name: string; count: number }>(`SELECT event_name, count(*)::int AS count FROM analytics_events WHERE created_at >= now() - interval '30 days' GROUP BY event_name`),
    database.query<{ status: string; count: number }>(`SELECT refund_status AS status, count(*)::int AS count FROM bookings WHERE refund_status <> 'none' GROUP BY refund_status`),
  ]);
  const totals = Object.fromEntries(emails.rows.map((row) => [row.status, row.count]));
  const events = Object.fromEntries(funnel.rows.map((row) => [row.event_name, row.count]));
  const refundTotals = Object.fromEntries(refunds.rows.map((row) => [row.status, row.count]));

  return <main className="min-h-screen bg-[#f4f4ef] px-5 py-8 text-[#183126] sm:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin operations</p><h1 className="mt-2 text-3xl font-bold">Reliability center</h1></div><Link href="/admin" className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">← Admin console</Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Database" value="Connected" good /><Card label="Email" value={isEmailConfigured() ? "Configured" : "Needs setup"} good={isEmailConfigured()} /><Card label="Emails sent · 7d" value={String(totals.sent ?? 0)} good /><Card label="Email failures · 7d" value={String(totals.failed ?? 0)} good={!totals.failed} /></div>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">30-day customer funnel</h2><p className="mt-1 text-sm text-[#718078]">From discovery through successful payment.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MiniMetric label="Searches" value={events.search_results ?? 0} /><MiniMetric label="Listing views" value={events.service_view ?? 0} /><MiniMetric label="Booking requests" value={events.booking_requested ?? 0} /><MiniMetric label="Payments" value={events.payment_completed ?? 0} /></div><div className="mt-4 rounded-2xl bg-[#f5f5ef] p-4 text-sm"><strong>Refund queue:</strong> {refundTotals.requested ?? 0} awaiting review · {refundTotals.refunded ?? 0} completed</div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Automated checks</h2><p className="mt-1 text-sm text-[#718078]">Scheduled jobs record each successful run here.</p><div className="mt-5 divide-y divide-[#183126]/10">{checks.rows.map((check) => <div key={check.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{check.check_type.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#718078]">{check.created_at.toLocaleString()}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${check.status === "ok" ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#fff0e8] text-[#964f2c]"}`}>{check.status}</span></div>)}{checks.rows.length === 0 && <p className="py-8 text-center text-sm text-[#718078]">No scheduled checks have run yet.</p>}</div></section>
    <section className="mt-6 rounded-[2rem] border border-[#183126]/10 bg-white p-6"><h2 className="text-xl font-bold">Recent account activity</h2><p className="mt-1 text-sm text-[#718078]">Security-sensitive booking, payment, messaging, and report actions.</p><div className="mt-5 divide-y divide-[#183126]/10">{activity.rows.map((entry) => <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold">{entry.action.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[#718078]">{entry.user_name ?? "Unknown account"} · {entry.target_type}{entry.target_id ? ` ${entry.target_id.slice(0, 8)}` : ""}</p></div><time className="text-xs font-semibold text-[#718078]">{entry.created_at.toLocaleString()}</time></div>)}{activity.rows.length === 0 && <p className="py-8 text-center text-sm text-[#718078]">No recorded activity yet.</p>}</div></section>
    <section className="mt-6 rounded-[2rem] bg-[#183126] p-6 text-white"><h2 className="text-xl font-bold">Production checklist</h2><ul className="mt-4 space-y-3 text-sm text-[#c4d0ca]"><li>✓ Public health endpoint at <code>/api/health</code></li><li>✓ Email delivery, Stripe webhooks, refunds, and audit logs</li><li>✓ 30-day search-to-payment analytics</li><li>○ Enable automatic backups on the DigitalOcean managed database</li><li>○ Schedule reminders every 10 minutes with the private cron secret</li><li>○ Connect an external uptime monitor and failed-deployment alerts</li><li>○ Perform a monthly backup restore test</li></ul></section>
  </div></main>;
}

function Card({ label, value, good }: { label: string; value: string; good: boolean }) { return <div className="rounded-2xl border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-3 text-xl font-bold">{value}</p><span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${good ? "bg-[#e4f1e5] text-[#35704a]" : "bg-[#fff0e8] text-[#964f2c]"}`}>{good ? "Healthy" : "Action needed"}</span></div>; }
function MiniMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-[#f5f5ef] p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p></div>; }
