import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAnalytics } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/request-security";

const allowedEvents = new Set(["page_view", "service_view", "search_results", "checkout_abandoned"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { eventName?: unknown; anonymousId?: unknown; path?: unknown; metadata?: unknown } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  if (!allowedEvents.has(eventName)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const path = typeof body?.path === "string" ? body.path.slice(0, 500) : null;
  const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId.slice(0, 100) : null;
  const metadata = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
  const session = await auth.api.getSession({ headers: await headers() });
  if (!await enforceRateLimit({ request, userId: session?.user.id ?? anonymousId ?? "guest", bucket: "analytics", limit: 60 })) return NextResponse.json({ ok: true });
  await recordAnalytics({ eventName, userId: session?.user.id, anonymousId, path, metadata });
  return NextResponse.json({ ok: true });
}
