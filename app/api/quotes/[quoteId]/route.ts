import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateBookingFinancialSnapshot, type BookingFinancialPlan } from "@/lib/booking-financials";
import { database } from "@/lib/database";
import { recordAnalytics } from "@/lib/analytics";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { sendBookingUpdateEmails } from "@/lib/booking-email";

export async function PATCH(request: Request, context: RouteContext<"/api/quotes/[quoteId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to respond to this quote." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "job-quote-response", limit: 15 })) return NextResponse.json({ error: "Too many quote changes. Please wait a minute." }, { status: 429 });
  const { quoteId } = await context.params;
  const body = await request.json() as { action?: unknown };
  const action = body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : "";
  if (!action) return NextResponse.json({ error: "Choose accept or decline." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string; customer_id: string; provider_id: string; provider_user_id: string; service_id: string; job_request_id: string;
      booking_id: string | null; quote_status: string; total_cents: number; request_status: string; preferred_starts_at: Date;
      address_line1: string; address_line2: string | null; city: string; state: string; postal_code: string; description: string;
      duration_minutes: number; service_title: string; plan: BookingFinancialPlan;
    }>(
      `SELECT quote.id::text, quote.customer_id, quote.provider_id::text, provider.user_id AS provider_user_id,
              quote.service_id::text, quote.job_request_id::text, quote.booking_id::text, quote.status AS quote_status,
              quote.total_cents, request.status AS request_status, request.preferred_starts_at,
              request.service_address_line1 AS address_line1, request.service_address_line2 AS address_line2,
              request.city, request.state, request.postal_code, request.description,
              service.duration_minutes, service.title AS service_title, provider.plan
       FROM quotes quote JOIN job_requests request ON request.id = quote.job_request_id
       JOIN services service ON service.id = quote.service_id JOIN provider_profiles provider ON provider.id = quote.provider_id
       WHERE quote.id::text = $1 AND quote.customer_id = $2
         AND (quote.expires_at IS NULL OR quote.expires_at > now())
       FOR UPDATE OF quote, request`,
      [quoteId, session.user.id],
    );
    const quote = result.rows[0];
    if (!quote) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Quote not found." }, { status: 404 }); }
    if (quote.booking_id) { await client.query("COMMIT"); return NextResponse.json({ ok: true, bookingId: quote.booking_id }); }
    if (quote.quote_status !== "sent" || !["open", "receiving_responses"].includes(quote.request_status)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This quote is no longer awaiting a response." }, { status: 409 }); }
    if (action === "decline") {
      await client.query("UPDATE quotes SET status = 'declined', declined_at = now() WHERE id::text = $1", [quoteId]);
      await client.query(`INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
        VALUES ($1,'job_quote','Quote declined',$2,'/provider/dashboard/opportunities',$3) ON CONFLICT (dedupe_key) DO NOTHING`, [quote.provider_user_id, `${session.user.name || "The customer"} declined your quote for ${quote.service_title}.`, `job-quote-declined-${quoteId}`]);
      await client.query("COMMIT");
      return NextResponse.json({ ok: true });
    }

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [quote.provider_id]);
    const startsAt = quote.preferred_starts_at;
    const endsAt = new Date(startsAt.getTime() + quote.duration_minutes * 60_000);
    const conflict = await client.query(
      `SELECT 1 FROM bookings WHERE provider_id::text = $1 AND status = 'confirmed' AND starts_at < $3 AND ends_at > $2 LIMIT 1`,
      [quote.provider_id, startsAt, endsAt],
    );
    if (conflict.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({ error: "That time was just booked. Ask the provider to send a revised quote with another time." }, { status: 409 }); }
    const snapshot = calculateBookingFinancialSnapshot(quote.total_cents, quote.plan);
    const formattedAddress = [quote.address_line1, quote.address_line2, `${quote.city}, ${quote.state} ${quote.postal_code}`].filter(Boolean).join(", ");
    const created = await client.query<{ id: string }>(
      `INSERT INTO bookings (customer_id, provider_id, service_id, starts_at, ends_at, status, service_address,
         service_address_line1, service_address_line2, service_city, service_state, service_postal_code, notes, price_cents,
         source_job_request_id, source_quote_id, provider_plan_snapshot, provider_fee_basis_points, platform_fee_cents,
         provider_payout_cents, customer_service_fee_cents, customer_total_cents)
       VALUES ($1,$2,$3,$4,$5,'confirmed',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id::text`,
      [session.user.id, quote.provider_id, quote.service_id, startsAt, endsAt, formattedAddress, quote.address_line1, quote.address_line2, quote.city, quote.state, quote.postal_code, quote.description, quote.total_cents, quote.job_request_id, quoteId, snapshot.providerPlan, snapshot.providerFeeBasisPoints, snapshot.providerFeeCents, snapshot.providerNetCents, snapshot.customerServiceFeeCents, snapshot.customerTotalCents],
    );
    const bookingId = created.rows[0].id;
    await client.query("INSERT INTO booking_assignees (booking_id, is_owner) VALUES ($1, true)", [bookingId]);
    await client.query("INSERT INTO booking_events (booking_id, actor_user_id, event_type, message) VALUES ($1,$2,'quote_accepted','Customer accepted the service-request quote. Booking confirmed pending payment.')", [bookingId, session.user.id]);
    await client.query("UPDATE quotes SET status = 'accepted', accepted_at = now(), booking_id = $2 WHERE id::text = $1", [quoteId, bookingId]);
    await client.query("UPDATE quotes SET status = 'declined', declined_at = now() WHERE job_request_id::text = $1 AND id::text <> $2 AND status = 'sent'", [quote.job_request_id, quoteId]);
    await client.query("UPDATE job_requests SET status = 'booking_created', accepted_quote_id = $2, booking_id = $3 WHERE id::text = $1", [quote.job_request_id, quoteId, bookingId]);
    await client.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key) VALUES
      ($1,$3,'job_quote','Quote accepted',$4,'/provider/dashboard/bookings/' || $3::uuid::text,$5),
      ($2,$3,'booking_confirmed','Booking created from your quote',$6,'/account/bookings/' || $3::uuid::text,$7)
      ON CONFLICT (dedupe_key) DO NOTHING`, [quote.provider_user_id, session.user.id, bookingId, `${session.user.name || "The customer"} accepted your quote for ${quote.service_title}.`, `job-quote-accepted-${quoteId}-provider`, `Your booking for ${quote.service_title} is ready for secure payment.`, `job-quote-accepted-${quoteId}-customer`]);
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: "job_quote_accepted", targetType: "quote", targetId: quoteId });
    await recordAnalytics({ eventName: "job_quote_accepted", userId: session.user.id, targetType: "quote", targetId: quoteId, metadata: { bookingId, totalCents: quote.total_cents } });
    await sendBookingUpdateEmails(bookingId, "accepted");
    return NextResponse.json({ ok: true, bookingId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Quote response failed", error);
    return NextResponse.json({ error: "We could not update this quote." }, { status: 500 });
  } finally { client.release(); }
}
