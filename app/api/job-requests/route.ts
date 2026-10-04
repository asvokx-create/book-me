import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAndRecordContent } from "@/lib/content-safety";
import { database } from "@/lib/database";
import { recordAnalytics } from "@/lib/analytics";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { distanceMiles } from "@/lib/service-areas";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { findUsCity } from "@/lib/us-cities";
import { normalizeUsZipCode, resolveUsZipCode } from "@/lib/us-zip-codes";
import { zonedDateTimeToUtc } from "@/lib/zoned-date-time";
import { isRequestDeliveryType, type RequestDeliveryType, type ServiceDeliveryType } from "@/lib/service-delivery";

type RequestRow = {
  id: string; customer_id: string; category: string; title: string; description: string;
  city: string | null; state: string | null; postal_code: string | null; delivery_type: RequestDeliveryType; preferred_starts_at: Date; preferred_time_zone: string | null; is_flexible: boolean;
  budget_min_cents: number | null; budget_max_cents: number | null; status: string; expires_at: Date;
  created_at: Date; service_address_line1?: string; service_address_line2?: string | null;
  matched_service_id?: string; matched_service_title?: string; matched_service_delivery_type?: ServiceDeliveryType; distance_miles?: number;
  conversation_id?: string | null; match_status?: string; viewed_at?: Date | null; responded_at?: Date | null;
};

type QuoteRow = {
  id: string; job_request_id: string; provider_id: string; provider_name: string; service_id: string; service_title: string;
  version: number; title: string; description: string; line_items: unknown; total_cents: number; notes: string;
  expires_at: Date | null; status: string; booking_id: string | null; created_at: Date;
  conversation_id: string | null; public_slug: string | null; public_profile_enabled: boolean; is_verified: boolean;
  average_rating: number | null; review_count: number;
  delivery_method: "IN_PERSON" | "REMOTE";
};

function mapQuote(row: QuoteRow) {
  return { id: row.id, requestId: row.job_request_id, providerId: row.provider_id, providerName: row.provider_name, serviceId: row.service_id, serviceTitle: row.service_title, version: row.version, title: row.title, description: row.description, lineItems: Array.isArray(row.line_items) ? row.line_items : [], total: row.total_cents / 100, notes: row.notes, expiresAt: row.expires_at, status: row.status, bookingId: row.booking_id, createdAt: row.created_at, conversationId: row.conversation_id, publicProfileHref: row.public_profile_enabled && row.public_slug ? `/providers/${row.public_slug}` : null, verified: row.is_verified, averageRating: row.average_rating, reviewCount: row.review_count, deliveryMethod: row.delivery_method };
}

async function quotesFor(requestIds: string[], providerId?: string) {
  if (requestIds.length === 0) return new Map<string, ReturnType<typeof mapQuote>[]>();
  const result = await database.query<QuoteRow>(
    `SELECT quote.id::text, quote.job_request_id::text, quote.provider_id::text,
            provider.business_name AS provider_name, quote.service_id::text, service.title AS service_title,
            quote.version, quote.title, quote.description, quote.line_items, quote.total_cents, quote.notes, COALESCE(quote.delivery_method, 'IN_PERSON') AS delivery_method,
            quote.expires_at, CASE WHEN quote.status = 'sent' AND quote.expires_at <= now() THEN 'expired' ELSE quote.status END AS status,
            quote.booking_id::text, quote.created_at, COALESCE(quote.conversation_id, match.conversation_id)::text AS conversation_id,
            provider.public_profile_slug AS public_slug, provider.public_profile_visible AS public_profile_enabled,
            (provider.is_verified = true AND provider.screening_status = 'passed'
              AND provider.screening_checked_at BETWEEN now() - interval '30 days' AND now()) AS is_verified,
            rating.average_rating, COALESCE(rating.review_count, 0)::int AS review_count
     FROM quotes quote JOIN provider_profiles provider ON provider.id = quote.provider_id
     JOIN services service ON service.id = quote.service_id
     LEFT JOIN job_request_matches match ON match.request_id = quote.job_request_id AND match.provider_id = quote.provider_id
     LEFT JOIN LATERAL (
       SELECT round(avg(review.rating)::numeric, 1)::float AS average_rating, count(*)::int AS review_count
       FROM reviews review JOIN bookings booking ON booking.id = review.booking_id
       WHERE booking.provider_id = provider.id AND booking.status = 'completed' AND review.is_hidden = false
     ) rating ON true
     WHERE quote.job_request_id::text = ANY($1::text[])
       AND ($2::uuid IS NULL OR quote.provider_id = $2::uuid)
     ORDER BY quote.created_at DESC`,
    [requestIds, providerId ?? null],
  );
  const grouped = new Map<string, ReturnType<typeof mapQuote>[]>();
  for (const row of result.rows) grouped.set(row.job_request_id, [...(grouped.get(row.job_request_id) ?? []), mapQuote(row)]);
  return grouped;
}

export async function GET(request: Request) {
  try {
    return await getJobRequests(request);
  } catch (error) {
    console.error("Service request loading failed", error);
    return NextResponse.json({ error: "Service requests are temporarily unavailable. Please try again." }, { status: 500 });
  }
}

async function getJobRequests(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to view service requests." }, { status: 401 });
  const providerView = new URL(request.url).searchParams.get("view") === "provider";

  if (providerView) {
    const access = await getProviderAccess();
    if (!access) return NextResponse.json({ error: "Provider access not found." }, { status: 403 });
    const result = await database.query<RequestRow>(
      `SELECT request.id::text, request.customer_id, request.category, request.title, request.description,
              request.city, request.state, request.postal_code, request.delivery_type, request.preferred_starts_at, request.preferred_time_zone, request.is_flexible,
              request.budget_min_cents, request.budget_max_cents, request.status, request.expires_at, request.created_at,
              match.service_id::text AS matched_service_id, service.title AS matched_service_title, service.delivery_type AS matched_service_delivery_type, match.distance_miles,
              match.conversation_id::text, match.status AS match_status, match.viewed_at, match.responded_at
       FROM job_request_matches match
       JOIN job_requests request ON request.id = match.request_id
       JOIN services service ON service.id = match.service_id
       JOIN provider_profiles eligible ON eligible.id = match.provider_id
       WHERE match.provider_id::text = $1 AND match.status <> 'dismissed'
         AND request.status IN ('open', 'receiving_responses') AND request.expires_at > now()
         AND eligible.is_active = true AND eligible.is_verified = true AND eligible.screening_status = 'passed'
         AND eligible.screening_checked_at BETWEEN now() - interval '30 days' AND now()
         AND eligible.stripe_charges_enabled = true AND eligible.stripe_payouts_enabled = true
         AND NOT EXISTS (SELECT 1 FROM account_restrictions restriction WHERE restriction.user_id = eligible.user_id
           AND restriction.status IN ('suspended', 'banned') AND (restriction.expires_at IS NULL OR restriction.expires_at > now()))
       ORDER BY request.created_at DESC`,
      [access.providerId],
    );
    const groupedQuotes = await quotesFor(result.rows.map((item) => item.id), access.providerId);
    const metricResult = await database.query<{ opportunities: number; responded: number; accepted: number; average_response_minutes: number | null }>(
      `SELECT count(*)::int AS opportunities,
              count(*) FILTER (WHERE match.status = 'responded')::int AS responded,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM quotes quote WHERE quote.job_request_id = match.request_id AND quote.provider_id = match.provider_id AND quote.status = 'accepted'))::int AS accepted,
              avg(EXTRACT(EPOCH FROM (first_quote.created_at - match.created_at)) / 60)::float AS average_response_minutes
       FROM job_request_matches match
       LEFT JOIN LATERAL (SELECT created_at FROM quotes WHERE job_request_id = match.request_id AND provider_id = match.provider_id ORDER BY created_at LIMIT 1) first_quote ON true
       WHERE match.provider_id::text = $1 AND match.created_at >= now() - interval '90 days'`,
      [access.providerId],
    );
    const metrics = metricResult.rows[0] ?? { opportunities: 0, responded: 0, accepted: 0, average_response_minutes: null };
    return NextResponse.json({
      metrics: { opportunities: metrics.opportunities, responded: metrics.responded, accepted: metrics.accepted, responseRate: metrics.opportunities >= 5 ? Math.round((metrics.responded / metrics.opportunities) * 100) : null, averageResponseMinutes: metrics.responded >= 3 ? Math.round(metrics.average_response_minutes ?? 0) : null, sampleProtected: metrics.opportunities < 5 },
      requests: result.rows.map((item) => ({ id: item.id, category: item.category, title: item.title, description: item.description, city: item.city, state: item.state, postalCode: item.postal_code, deliveryType: item.delivery_type, preferredStartsAt: item.preferred_starts_at, preferredTimeZone: item.preferred_time_zone ?? "UTC", flexible: item.is_flexible, budgetMin: item.budget_min_cents === null ? null : item.budget_min_cents / 100, budgetMax: item.budget_max_cents === null ? null : item.budget_max_cents / 100, status: item.status, expiresAt: item.expires_at, createdAt: item.created_at, matchedServiceId: item.matched_service_id, matchedServiceTitle: item.matched_service_title, matchedServiceDeliveryType: item.matched_service_delivery_type, distanceMiles: item.distance_miles, conversationId: item.conversation_id, matchStatus: item.match_status, viewedAt: item.viewed_at, respondedAt: item.responded_at, quotes: groupedQuotes.get(item.id) ?? [] })),
    });
  }

  const result = await database.query<RequestRow>(
    `SELECT id::text, customer_id, category, title, description, city, state, postal_code, delivery_type,
            service_address_line1, service_address_line2, preferred_starts_at, preferred_time_zone, is_flexible,
            budget_min_cents, budget_max_cents, status, expires_at, created_at
     FROM job_requests WHERE customer_id = $1 ORDER BY created_at DESC`,
    [session.user.id],
  );
  const groupedQuotes = await quotesFor(result.rows.map((item) => item.id));
  return NextResponse.json({ requests: result.rows.map((item) => ({ id: item.id, category: item.category, title: item.title, description: item.description, addressLine1: item.service_address_line1, addressLine2: item.service_address_line2 ?? "", city: item.city, state: item.state, postalCode: item.postal_code, deliveryType: item.delivery_type, preferredStartsAt: item.preferred_starts_at, preferredTimeZone: item.preferred_time_zone ?? "UTC", flexible: item.is_flexible, budgetMin: item.budget_min_cents === null ? null : item.budget_min_cents / 100, budgetMax: item.budget_max_cents === null ? null : item.budget_max_cents / 100, status: item.status, expiresAt: item.expires_at, createdAt: item.created_at, quotes: groupedQuotes.get(item.id) ?? [] })) });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to request a service." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "job-request-create", limit: 8, windowSeconds: 3600 })) return NextResponse.json({ error: "Too many service requests. Please try again later." }, { status: 429 });
  const body = await request.json() as Record<string, unknown>;
  const category = typeof body.category === "string" && SERVICE_CATEGORIES.includes(body.category as typeof SERVICE_CATEGORIES[number]) ? body.category : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const deliveryType = isRequestDeliveryType(body.deliveryType) ? body.deliveryType : "IN_PERSON";
  const addressLine1 = typeof body.addressLine1 === "string" ? body.addressLine1.trim() : "";
  const addressLine2 = typeof body.addressLine2 === "string" ? body.addressLine2.trim() : "";
  const cityInput = typeof body.city === "string" ? body.city.trim() : "";
  const stateInput = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const postalCode = normalizeUsZipCode(typeof body.postalCode === "string" ? body.postalCode : "");
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  const timeZone = typeof body.timeZone === "string" ? body.timeZone : "";
  const flexible = body.flexible === true;
  const budgetMin = body.budgetMin === "" || body.budgetMin == null ? null : Number(body.budgetMin);
  const budgetMax = body.budgetMax === "" || body.budgetMax == null ? null : Number(body.budgetMax);
  const preferredStartsAt = zonedDateTimeToUtc(date, time, timeZone);
  const requiresLocation = deliveryType !== "REMOTE";
  const zipPlace = requiresLocation && postalCode ? await resolveUsZipCode(postalCode) : undefined;
  const place = requiresLocation ? zipPlace ?? findUsCity(`${cityInput}, ${stateInput}`) : undefined;
  if (!category || title.length < 3 || title.length > 120 || description.length < 20 || description.length > 3000 || (requiresLocation && (!addressLine1 || !postalCode || !place)) || addressLine1.length > 120 || addressLine2.length > 80 || !preferredStartsAt || preferredStartsAt.getTime() < Date.now() || (budgetMin !== null && (!Number.isFinite(budgetMin) || budgetMin < 0)) || (budgetMax !== null && (!Number.isFinite(budgetMax) || budgetMax < (budgetMin ?? 0)))) return NextResponse.json({ error: "Complete the service, delivery, schedule, and optional budget with valid information." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "job_request", fields: [title, description, ...(requiresLocation ? [addressLine1, addressLine2] : [])] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });

  const candidateResult = await database.query<{
    provider_id: string; provider_user_id: string; service_id: string; latitude: number | null; longitude: number | null;
    service_radius_miles: number | null; explicit_match: boolean; delivery_type: ServiceDeliveryType;
  }>(
    `SELECT provider.id::text AS provider_id, provider.user_id AS provider_user_id, service.id::text AS service_id,
            location.latitude, location.longitude, location.service_radius_miles, service.delivery_type,
            COALESCE(EXISTS(SELECT 1 FROM provider_location_service_areas area WHERE area.location_id = location.id
              AND ((area.area_type = 'zip' AND area.postal_code = $2) OR lower(area.city || ', ' || area.state) = lower($3))), false) AS explicit_match
     FROM services service JOIN provider_profiles provider ON provider.id = service.provider_id AND provider.is_active = true
     LEFT JOIN provider_locations location ON location.id = service.location_id AND location.is_active = true
     WHERE service.is_active = true AND lower(service.category) = lower($1)
       AND (($6 = 'REMOTE' AND service.delivery_type IN ('REMOTE','BOTH'))
         OR ($6 = 'IN_PERSON' AND service.delivery_type IN ('IN_PERSON','BOTH'))
         OR ($6 = 'EITHER'))
       AND provider.is_verified = true AND provider.screening_status = 'passed'
       AND provider.screening_checked_at BETWEEN now() - interval '30 days' AND now()
       AND provider.stripe_charges_enabled = true AND provider.stripe_payouts_enabled = true
       AND NOT EXISTS (
         SELECT 1 FROM account_restrictions restriction
         WHERE restriction.user_id = provider.user_id
           AND restriction.status IN ('suspended', 'banned')
           AND (restriction.expires_at IS NULL OR restriction.expires_at > now())
       )
       AND ($4::boolean OR NOT EXISTS (SELECT 1 FROM availability configured WHERE configured.service_id = service.id)
         OR EXISTS (
           SELECT 1 FROM availability slot
           WHERE slot.service_id = service.id
             AND slot.weekday = EXTRACT(DOW FROM ($5::timestamptz AT TIME ZONE slot.timezone))::int
             AND ($5::timestamptz AT TIME ZONE slot.timezone)::time >= slot.start_time
             AND (($5::timestamptz + make_interval(mins => service.duration_minutes)) AT TIME ZONE slot.timezone)::time <= slot.end_time
         ))
     ORDER BY service.created_at DESC LIMIT 250`,
    [category, postalCode, place ? `${place.city}, ${place.state}` : "", flexible, preferredStartsAt, deliveryType],
  );
  const matched = new Map<string, { providerId: string; providerUserId: string; serviceId: string; distance: number }>();
  for (const candidate of candidateResult.rows) {
    const canMatchRemotely = candidate.delivery_type === "REMOTE" || (candidate.delivery_type === "BOTH" && deliveryType !== "IN_PERSON");
    if (!canMatchRemotely && (!place || !Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude))) continue;
    const distance = canMatchRemotely ? 0 : distanceMiles(place!, { latitude: candidate.latitude!, longitude: candidate.longitude! });
    if (!canMatchRemotely && !candidate.explicit_match && distance > (candidate.service_radius_miles ?? 0)) continue;
    const existing = matched.get(candidate.provider_id);
    if (!existing || distance < existing.distance) matched.set(candidate.provider_id, { providerId: candidate.provider_id, providerUserId: candidate.provider_user_id, serviceId: candidate.service_id, distance });
  }

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query<{ id: string }>(
      `INSERT INTO job_requests (customer_id, category, title, description, service_address_line1, service_address_line2,
         city, state, postal_code, latitude, longitude, preferred_starts_at, preferred_time_zone, is_flexible, budget_min_cents, budget_max_cents, delivery_type)
       VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),$7,$8,NULLIF($9,''),$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id::text`,
      [session.user.id, category, title, description, addressLine1, addressLine2, place?.city ?? null, place?.state ?? null, postalCode, place?.latitude ?? null, place?.longitude ?? null, preferredStartsAt, timeZone, flexible, budgetMin === null ? null : Math.round(budgetMin * 100), budgetMax === null ? null : Math.round(budgetMax * 100), deliveryType],
    );
    const requestId = created.rows[0].id;
    for (const item of matched.values()) {
      const conversation = await client.query<{ id: string }>(
        `INSERT INTO conversations (customer_id, provider_id, service_id)
         VALUES ($1,$2,$3) ON CONFLICT (customer_id, provider_id, service_id) WHERE service_id IS NOT NULL
         DO UPDATE SET customer_deleted_at = NULL, provider_deleted_at = NULL, updated_at = now()
         RETURNING id::text`,
        [session.user.id, item.providerId, item.serviceId],
      );
      await client.query("INSERT INTO job_request_matches (request_id, provider_id, service_id, distance_miles, conversation_id) VALUES ($1,$2,$3,$4,$5)", [requestId, item.providerId, item.serviceId, item.distance, conversation.rows[0].id]);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
         SELECT $1,'job_request_match','New service request',$2,$4,$3
         WHERE COALESCE((SELECT opportunity_notifications FROM user_settings WHERE user_id = $1), true)
         ON CONFLICT (dedupe_key) DO NOTHING`,
        [item.providerUserId, deliveryType === "REMOTE" ? `Remote ${category.toLowerCase()} request. Responding and quoting are free.` : `${category} request near ${place?.city}, ${place?.state}. Responding and quoting are free.`, `job-request-${requestId}-${item.providerId}`, `/provider/dashboard/opportunities?requestId=${requestId}`],
      );
      await client.query(
        `INSERT INTO job_request_notification_queue (user_id, job_request_id, kind, payload, dedupe_key)
         VALUES ($1,$2,'provider_opportunity',$3::jsonb,$4) ON CONFLICT (dedupe_key) DO NOTHING`,
        [item.providerUserId, requestId, JSON.stringify({ category, deliveryType, city: place?.city ?? null, state: place?.state ?? null }), `job-request-email-${requestId}-${item.providerId}`],
      );
    }
    await client.query("UPDATE job_requests SET matching_status = 'completed', matching_completed_at = now(), matched_provider_count = $2 WHERE id::text = $1", [requestId, matched.size]);
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: "job_request_created", targetType: "job_request", targetId: requestId });
    await recordAnalytics({ eventName: "job_request_created", userId: session.user.id, targetType: "job_request", targetId: requestId, metadata: { category, deliveryType, city: place?.city ?? null, state: place?.state ?? null, matchedProviders: matched.size } });
    await recordAnalytics({ eventName: deliveryType === "REMOTE" ? "remote_request_created" : "local_request_created", userId: session.user.id, targetType: "job_request", targetId: requestId });
    return NextResponse.json({ id: requestId, matchedProviders: matched.size }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Job request creation failed", error);
    return NextResponse.json({ error: "We could not send this service request." }, { status: 500 });
  } finally { client.release(); }
}
