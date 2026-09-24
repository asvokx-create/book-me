import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { recordAnalytics } from "@/lib/analytics";
import { sendTransactionalEmail } from "@/lib/email";

type LineItem = { label: string; amount: number };

export async function POST(request: Request, context: RouteContext<"/api/job-requests/[requestId]/quotes">) {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider access not found." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: access.session.user.id, bucket: "job-quote-send", limit: 20 })) return NextResponse.json({ error: "Too many quote changes. Please wait a minute." }, { status: 429 });
  const { requestId } = await context.params;
  const body = await request.json() as Record<string, unknown>;
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const total = Number(body.total);
  const expiresInDays = body.expiresInDays == null ? 7 : Number(body.expiresInDays);
  const rawItems = Array.isArray(body.lineItems) ? body.lineItems : [];
  const lineItems: LineItem[] = rawItems.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label.trim() : "";
    const amount = Number((item as { amount?: unknown }).amount);
    return label && Number.isFinite(amount) && amount >= 0 ? [{ label, amount: Math.round(amount * 100) }] : [];
  });
  if (!serviceId || title.length < 3 || title.length > 120 || description.length > 1000 || notes.length > 1000 || !Number.isFinite(total) || total < 1 || total > 1_000_000 || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) return NextResponse.json({ error: "Enter a valid title, total, and expiration." }, { status: 400 });
  const totalCents = Math.round(total * 100);
  if (lineItems.length && lineItems.reduce((sum, item) => sum + item.amount, 0) !== totalCents) return NextResponse.json({ error: "Line items must add up to the quote total." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: access.session.user.id, surface: "job_quote", fields: [title, description, notes, ...lineItems.map((item) => item.label)] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const match = await client.query<{ customer_id: string; customer_email: string; customer_notifications: boolean; status: string; service_id: string; conversation_id: string | null }>(
      `SELECT request.customer_id, customer.email AS customer_email,
              COALESCE(settings.booking_notifications, true) AS customer_notifications,
              request.status, match.service_id::text,
              (SELECT conversation.id::text FROM conversations conversation
               WHERE conversation.customer_id = request.customer_id AND conversation.provider_id = match.provider_id
                 AND conversation.service_id = match.service_id LIMIT 1) AS conversation_id
       FROM job_request_matches match JOIN job_requests request ON request.id = match.request_id
       JOIN "user" customer ON customer.id = request.customer_id
       LEFT JOIN user_settings settings ON settings.user_id = customer.id
       WHERE request.id::text = $1 AND match.provider_id::text = $2 AND match.service_id::text = $3
         AND request.status IN ('open','receiving_responses') AND request.expires_at > now()
       FOR UPDATE OF request, match`,
      [requestId, access.providerId, serviceId],
    );
    const matched = match.rows[0];
    if (!matched) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This request is no longer available to quote." }, { status: 409 }); }
    const latest = await client.query<{ id: string; version: number }>(
      `SELECT id::text, version FROM quotes WHERE job_request_id::text = $1 AND provider_id::text = $2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
      [requestId, access.providerId],
    );
    const previous = latest.rows[0];
    if (previous) await client.query("UPDATE quotes SET status = 'superseded' WHERE id::text = $1 AND status = 'sent'", [previous.id]);
    const created = await client.query<{ id: string }>(
      `INSERT INTO quotes (customer_id, provider_id, service_id, job_request_id, conversation_id, version, title,
         description, line_items, total_cents, notes, expires_at, supersedes_quote_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,now() + make_interval(days => $12),$13::uuid)
       RETURNING id::text`,
      [matched.customer_id, access.providerId, serviceId, requestId, matched.conversation_id, (previous?.version ?? 0) + 1, title, description, JSON.stringify(lineItems), totalCents, notes, expiresInDays, previous?.id ?? null],
    );
    await client.query("UPDATE job_request_matches SET status = 'responded', updated_at = now() WHERE request_id::text = $1 AND provider_id::text = $2", [requestId, access.providerId]);
    await client.query("UPDATE job_requests SET status = 'receiving_responses' WHERE id::text = $1 AND status = 'open'", [requestId]);
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
       VALUES ($1,'job_quote','New quote for your service request',$2,'/account/requests',$3)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [matched.customer_id, `${access.session.user.name || "A provider"} sent a $${total.toFixed(2)} quote.`, `job-quote-${created.rows[0].id}`],
    );
    await client.query("COMMIT");
    await recordActivity({ userId: access.session.user.id, action: "job_quote_sent", targetType: "quote", targetId: created.rows[0].id });
    await recordAnalytics({ eventName: "job_quote_sent", userId: access.session.user.id, targetType: "quote", targetId: created.rows[0].id, metadata: { requestId, totalCents } });
    const providerQuoteCount = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM quotes WHERE provider_id::text = $1", [access.providerId]);
    if (providerQuoteCount.rows[0]?.count === 1) await recordAnalytics({ eventName: "first_quote_sent", userId: access.session.user.id, targetType: "quote", targetId: created.rows[0].id });
    if (matched.customer_notifications) await sendTransactionalEmail({ to: matched.customer_email, userId: matched.customer_id, emailType: `job_quote_${created.rows[0].id}`, idempotencyKey: `job-quote-${created.rows[0].id}`, subject: "You received a new BubsBookings quote", heading: "A provider responded to your service request", message: `${access.session.user.name || "A local provider"} sent a $${total.toFixed(2)} quote. Compare the details before accepting.`, actionLabel: "Review quote", actionUrl: "/account/requests" });
    return NextResponse.json({ id: created.rows[0].id }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Job quote creation failed", error);
    return NextResponse.json({ error: "We could not send this quote." }, { status: 500 });
  } finally { client.release(); }
}
