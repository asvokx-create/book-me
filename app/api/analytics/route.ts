import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAnalytics } from "@/lib/analytics";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";

const allowedEvents = new Set(["page_view", "service_view", "search_results", "zero_result_search", "checkout_abandoned"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { eventName?: unknown; anonymousId?: unknown; path?: unknown; metadata?: unknown } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  if (!allowedEvents.has(eventName)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const path = typeof body?.path === "string" ? body.path.slice(0, 500) : null;
  const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId.slice(0, 100) : null;
  const metadata = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
  const session = await auth.api.getSession({ headers: await headers() });
  if (!await enforceRateLimit({ request, userId: session?.user.id ?? anonymousId ?? "guest", bucket: "analytics", limit: 60 })) return NextResponse.json({ ok: true });
  let targetType: string | null = null;
  let targetId: string | null = null;
  if (eventName === "service_view") {
    const slug = typeof metadata.slug === "string" ? metadata.slug.slice(0, 200) : "";
    if (!slug) return NextResponse.json({ ok: true });
    const service = await database.query<{ id: string; owner_user_id: string }>(
      `SELECT s.id::text, p.user_id AS owner_user_id
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.slug = $1 AND s.is_active = true`,
      [slug],
    );
    if (!service.rows[0] || service.rows[0].owner_user_id === session?.user.id) return NextResponse.json({ ok: true });
    targetType = "service";
    targetId = service.rows[0].id;
  }
  await recordAnalytics({ eventName, userId: session?.user.id, anonymousId, path, targetType, targetId, metadata });
  return NextResponse.json({ ok: true });
}
