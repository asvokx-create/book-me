import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

const categories = new Set(["harassment", "spam", "unsafe", "other"]);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "safety-report", limit: 6, windowSeconds: 3600 })) {
    return NextResponse.json({ error: "Too many reports. Please try again later." }, { status: 429 });
  }
  const body = (await request.json()) as { conversationId?: unknown; bookingId?: unknown; category?: unknown; details?: unknown };
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : "";
  const category = typeof body.category === "string" ? body.category : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if ((!conversationId && !bookingId) || (conversationId && bookingId) || !categories.has(category) || details.length < 10 || details.length > 1000) {
    return NextResponse.json({ error: "Choose a reason and describe what happened in 10–1,000 characters." }, { status: 400 });
  }

  const result = conversationId
    ? await database.query<{ id: string }>(
      `INSERT INTO safety_reports (conversation_id, reporter_id, reported_user_id, category, details)
       SELECT c.id, $2, CASE WHEN c.customer_id = $2 THEN p.user_id ELSE c.customer_id END, $3, $4
       FROM conversations c
       JOIN provider_profiles p ON p.id = c.provider_id
       WHERE c.id::text = $1 AND (c.customer_id = $2 OR p.user_id = $2)
       ON CONFLICT (conversation_id, reporter_id) WHERE conversation_id IS NOT NULL AND status IN ('open', 'reviewing') DO UPDATE
         SET category = EXCLUDED.category, details = EXCLUDED.details, updated_at = now()
       RETURNING id::text`,
      [conversationId, session.user.id, category, details],
    )
    : await database.query<{ id: string }>(
      `INSERT INTO safety_reports (booking_id, reporter_id, reported_user_id, category, details)
       SELECT b.id, $2, CASE WHEN b.customer_id = $2 THEN p.user_id ELSE b.customer_id END, $3, $4
       FROM bookings b
       JOIN provider_profiles p ON p.id = b.provider_id
       WHERE b.id::text = $1 AND (b.customer_id = $2 OR p.user_id = $2)
       ON CONFLICT (booking_id, reporter_id) WHERE booking_id IS NOT NULL AND status IN ('open', 'reviewing') DO UPDATE
         SET category = EXCLUDED.category, details = EXCLUDED.details, updated_at = now()
       RETURNING id::text`,
      [bookingId, session.user.id, category, details],
    );
  if (!result.rows[0]) return NextResponse.json({ error: "That booking or conversation was not found." }, { status: 404 });
  await recordActivity({ userId: session.user.id, action: "safety_report_created", targetType: "safety_report", targetId: result.rows[0].id });
  return NextResponse.json({ ok: true, reportId: result.rows[0].id }, { status: 201 });
}
