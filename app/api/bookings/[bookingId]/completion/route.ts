import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { releaseBookingPayout } from "@/lib/payment-release";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/bookings/[bookingId]/completion">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Sign in to confirm this service." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "booking-completion", limit: 8 }))
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  const { bookingId } = await context.params;
  const result = await database.query<{ id: string }>(`UPDATE bookings SET customer_confirmed_at = now()
    WHERE id::text = $1 AND customer_id = $2 AND status = 'completed'
      AND payment_status = 'paid' AND payment_release_status IN ('awaiting_customer', 'failed')
      AND payout_frozen_at IS NULL RETURNING id::text`, [bookingId, session.user.id]);
  if (!result.rows[0]) return NextResponse.json({ error: "This payment cannot be released right now. Check for an open dispute, refund, or payout hold." }, { status: 409 });
  const release = await releaseBookingPayout(bookingId, "customer");
  if (!release.ok) return NextResponse.json({ error: release.error }, { status: 409 });
  await recordActivity({ userId: session.user.id, action: "service_completion_confirmed", targetType: "booking", targetId: bookingId });
  return NextResponse.json({ ok: true });
}
