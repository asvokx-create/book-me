import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { getProviderAccess } from "@/lib/provider-access";
import { recordAnalytics } from "@/lib/analytics";

export async function PATCH(request: Request, context: RouteContext<"/api/job-requests/[requestId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to update this request." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "job-request-update", limit: 15 })) return NextResponse.json({ error: "Too many changes. Please wait a minute." }, { status: 429 });
  const { requestId } = await context.params;
  const body = await request.json() as { action?: unknown };
  const action = body.action === "cancel" || body.action === "view" || body.action === "dismiss" ? body.action : "";
  if (!action) return NextResponse.json({ error: "Choose a valid request action." }, { status: 400 });
  if (action !== "cancel") {
    const access = await getProviderAccess();
    if (!access) return NextResponse.json({ error: "Provider access not found." }, { status: 403 });
    const nextStatus = action === "dismiss" ? "dismissed" : "viewed";
    const result = await database.query(
      `UPDATE job_request_matches match
       SET status = CASE WHEN match.status = 'responded' THEN match.status ELSE $3 END,
           viewed_at = COALESCE(match.viewed_at, now()),
           dismissed_at = CASE WHEN $3 = 'dismissed' THEN now() ELSE match.dismissed_at END,
           updated_at = now()
       FROM job_requests request, provider_profiles eligible
       WHERE match.request_id = request.id AND request.id::text = $1 AND match.provider_id::text = $2
         AND eligible.id = match.provider_id AND eligible.is_active = true AND eligible.is_verified = true
         AND eligible.screening_status = 'passed'
         AND eligible.screening_checked_at BETWEEN now() - interval '30 days' AND now()
         AND eligible.stripe_charges_enabled = true AND eligible.stripe_payouts_enabled = true
         AND NOT EXISTS (SELECT 1 FROM account_restrictions restriction WHERE restriction.user_id = eligible.user_id
           AND restriction.status IN ('suspended', 'banned') AND (restriction.expires_at IS NULL OR restriction.expires_at > now()))
         AND request.status IN ('open', 'receiving_responses') AND request.expires_at > now()
       RETURNING match.request_id`,
      [requestId, access.providerId, nextStatus],
    );
    if (!result.rowCount) return NextResponse.json({ error: "This opportunity is no longer available." }, { status: 409 });
    await recordActivity({ userId: session.user.id, action: `job_request_${action}ed`, targetType: "job_request", targetId: requestId });
    await recordAnalytics({ eventName: `job_request_${action}ed`, userId: session.user.id, targetType: "job_request", targetId: requestId });
    return NextResponse.json({ ok: true });
  }
  const result = await database.query(
    `UPDATE job_requests SET status = 'cancelled' WHERE id::text = $1 AND customer_id = $2
       AND status IN ('open','receiving_responses') RETURNING id`,
    [requestId, session.user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "This request can no longer be cancelled." }, { status: 409 });
  await database.query("UPDATE quotes SET status = 'expired' WHERE job_request_id::text = $1 AND status = 'sent'", [requestId]);
  await database.query(
    `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
     SELECT provider.user_id, 'job_request', 'Service request cancelled', 'The customer cancelled a request you responded to.', '/provider/dashboard/opportunities', $2 || provider.id::text
     FROM job_request_matches match JOIN provider_profiles provider ON provider.id = match.provider_id
     WHERE match.request_id::text = $1 AND match.status = 'responded'
     ON CONFLICT (dedupe_key) DO NOTHING`,
    [requestId, `job-request-cancelled-${requestId}-`],
  );
  await recordActivity({ userId: session.user.id, action: "job_request_cancelled", targetType: "job_request", targetId: requestId });
  return NextResponse.json({ ok: true });
}
