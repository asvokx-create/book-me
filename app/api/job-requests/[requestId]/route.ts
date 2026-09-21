import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function PATCH(request: Request, context: RouteContext<"/api/job-requests/[requestId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to update this request." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "job-request-update", limit: 15 })) return NextResponse.json({ error: "Too many changes. Please wait a minute." }, { status: 429 });
  const { requestId } = await context.params;
  const body = await request.json() as { action?: unknown };
  if (body.action !== "cancel") return NextResponse.json({ error: "Choose a valid request action." }, { status: 400 });
  const result = await database.query(
    `UPDATE job_requests SET status = 'cancelled' WHERE id::text = $1 AND customer_id = $2
       AND status IN ('open','receiving_responses') RETURNING id`,
    [requestId, session.user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "This request can no longer be cancelled." }, { status: 409 });
  await database.query("UPDATE quotes SET status = 'expired' WHERE job_request_id::text = $1 AND status = 'sent'", [requestId]);
  await recordActivity({ userId: session.user.id, action: "job_request_cancelled", targetType: "job_request", targetId: requestId });
  return NextResponse.json({ ok: true });
}
