import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

type RequestTrace = {
  id: string; category: string; title: string; city: string; state: string; status: string; matching_status: string;
  matched_provider_count: number; matches: number; viewed: number; responded: number; dismissed: number; quotes: number;
  accepted_quotes: number; booking_id: string | null; queue_statuses: string[]; provider_names: string[]; customer_name: string; created_at: Date; expires_at: Date;
};

export default async function AdminRequestsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login?redirect=/admin/requests");
  const result = await database.query<RequestTrace>(
    `SELECT request.id::text, request.category, request.title, request.city, request.state, request.status, customer.name AS customer_name,
            request.matching_status, request.matched_provider_count, request.booking_id::text,
            request.created_at, request.expires_at,
            count(DISTINCT match.provider_id)::int AS matches,
            count(DISTINCT match.provider_id) FILTER (WHERE match.viewed_at IS NOT NULL)::int AS viewed,
            count(DISTINCT match.provider_id) FILTER (WHERE match.status = 'responded')::int AS responded,
            count(DISTINCT match.provider_id) FILTER (WHERE match.status = 'dismissed')::int AS dismissed,
            count(DISTINCT quote.id)::int AS quotes,
            count(DISTINCT quote.id) FILTER (WHERE quote.status = 'accepted')::int AS accepted_quotes,
            COALESCE(array_agg(DISTINCT queue.status) FILTER (WHERE queue.status IS NOT NULL), ARRAY[]::text[]) AS queue_statuses,
            COALESCE(array_agg(DISTINCT provider.business_name) FILTER (WHERE provider.business_name IS NOT NULL), ARRAY[]::text[]) AS provider_names
     FROM job_requests request
     JOIN "user" customer ON customer.id = request.customer_id
     LEFT JOIN job_request_matches match ON match.request_id = request.id
     LEFT JOIN provider_profiles provider ON provider.id = match.provider_id
     LEFT JOIN quotes quote ON quote.job_request_id = request.id
     LEFT JOIN job_request_notification_queue queue ON queue.job_request_id = request.id
     GROUP BY request.id, customer.name
     ORDER BY request.created_at DESC LIMIT 100`,
  );
  return <main className="min-h-screen bg-[#f4f4ef] px-4 py-8 text-[#183126] sm:px-8"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Admin marketplace trace</p><h1 className="mt-2 text-3xl font-bold">Service requests</h1><p className="mt-2 text-sm text-[#718078]">Privacy-safe request, matching, quote, and booking status. Exact addresses and customer contact details are not shown.</p></div><BackButton label="Back to admin" fallbackHref="/admin" /></div><div className="mt-8 space-y-4">{result.rows.map((item) => <article key={item.id} className="rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Pill value={item.status} /><Pill value={`matching ${item.matching_status}`} /></div><h2 className="mt-3 text-xl font-bold">{item.title}</h2><p className="mt-1 text-sm text-[#718078]">{item.category} · {item.city}, {item.state} · Customer: {item.customer_name} · {item.id.slice(0, 8)}</p></div><div className="text-xs text-[#718078] sm:text-right"><p>Created {item.created_at.toLocaleString()}</p><p className="mt-1">Expires {item.expires_at.toLocaleString()}</p></div></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"><Metric label="Matched" value={item.matches} /><Metric label="Viewed" value={item.viewed} /><Metric label="Responded" value={item.responded} /><Metric label="Dismissed" value={item.dismissed} /><Metric label="Quotes" value={item.quotes} /><Metric label="Accepted" value={item.accepted_quotes} /><Metric label="Booking" value={item.booking_id ? "Created" : "—"} /></div><div className="mt-4 space-y-1 text-xs text-[#718078]"><p>Matched providers: {item.provider_names.length ? item.provider_names.join(", ") : "None"}</p><p>Notification queue: {item.queue_statuses.length ? item.queue_statuses.join(", ") : "No queued emails"}</p>{item.booking_id && <p>Booking record: {item.booking_id}</p>}</div></article>)}{result.rows.length === 0 && <div className="rounded-[2rem] bg-white p-10 text-center text-sm text-[#718078]">No service requests have been posted.</div>}</div></div></main>;
}

function Pill({ value }: { value: string }) { return <span className="rounded-full bg-[#edf3e8] px-3 py-1 text-[11px] font-bold capitalize">{value.replaceAll("_", " ")}</span>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-xl bg-[#f5f5ef] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
