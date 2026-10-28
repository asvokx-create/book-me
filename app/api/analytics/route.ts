import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordAnalytics } from "@/lib/analytics";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { MAX_SEARCH_RADIUS_MILES } from "@/lib/search-radius";

const shareEvents = new Map([
  ["listing_share_opened", "opened"], ["listing_share_native", "native"], ["listing_share_copy_link", "copy_link"],
  ["listing_share_facebook", "facebook"], ["listing_share_x", "x"], ["listing_share_whatsapp", "whatsapp"],
  ["listing_share_linkedin", "linkedin"], ["listing_share_email", "email"],
]);
const providerShareEvents = new Map([...shareEvents.entries()].map(([event, method]) => [event.replace("listing_", "provider_"), method]));
const allowedEvents = new Set(["page_view", "service_view", "provider_profile_view", "search_results", "zero_result_search", "local_search", "remote_search", "checkout_abandoned", ...shareEvents.keys(), ...providerShareEvents.keys()]);

function safePath(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value, "https://bubsbookings.com");
    return parsed.pathname.startsWith("/") ? parsed.pathname.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function safeSearchMetadata(value: Record<string, unknown>) {
  const text = (field: string, max: number) => typeof value[field] === "string" ? value[field].slice(0, max) : "";
  const number = (field: string, max: number) => typeof value[field] === "number" && Number.isFinite(value[field]) ? Math.min(Math.max(0, Math.floor(value[field])), max) : 0;
  return {
    queryLength: number("queryLength", 200),
    category: text("category", 80),
    delivery: text("delivery", 20),
    location: text("location", 100),
    radiusMiles: number("radiusMiles", MAX_SEARCH_RADIUS_MILES),
    resultCount: number("resultCount", 10_000),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { eventName?: unknown; anonymousId?: unknown; path?: unknown; metadata?: unknown } | null;
  const eventName = typeof body?.eventName === "string" ? body.eventName : "";
  if (!allowedEvents.has(eventName)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  const path = safePath(body?.path);
  const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId.slice(0, 100) : null;
  let metadata = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, unknown> : {};
  if (["search_results", "zero_result_search", "local_search", "remote_search"].includes(eventName)) metadata = safeSearchMetadata(metadata);
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
  if (eventName === "provider_profile_view") {
    const kind = metadata.kind === "companies" ? "companies" : "providers";
    const slug = typeof metadata.slug === "string" ? metadata.slug.slice(0, 200) : "";
    if (!slug) return NextResponse.json({ ok: true });
    const profile = kind === "companies"
      ? await database.query<{ id: string; owner_user_id: string }>(`SELECT company.id::text, provider.user_id AS owner_user_id FROM provider_companies company JOIN provider_profiles provider ON provider.id = company.provider_id WHERE company.slug = $1 AND company.is_active = true AND provider.is_active = true`, [slug])
      : await database.query<{ id: string; owner_user_id: string }>(`SELECT provider.id::text, provider.user_id AS owner_user_id FROM provider_profiles provider WHERE (lower(provider.public_profile_slug) = lower($1) OR provider.id::text = $1) AND provider.is_active = true AND provider.public_profile_visible = true`, [slug]);
    if (!profile.rows[0] || profile.rows[0].owner_user_id === session?.user.id) return NextResponse.json({ ok: true });
    targetType = kind === "companies" ? "company" : "provider";
    targetId = profile.rows[0].id;
  }
  if (shareEvents.has(eventName)) {
    const serviceId = typeof metadata.serviceId === "string" ? metadata.serviceId.slice(0, 100) : "";
    if (!serviceId) return NextResponse.json({ ok: true });
    const service = await database.query<{ id: string; provider_id: string }>(
      `SELECT s.id::text, s.provider_id::text
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1 AND s.is_active = true AND p.is_active = true
       LIMIT 1`,
      [serviceId],
    );
    if (!service.rows[0]) return NextResponse.json({ ok: true });
    targetType = "service";
    targetId = service.rows[0].id;
    metadata = { method: shareEvents.get(eventName), providerId: service.rows[0].provider_id };
  }
  if (providerShareEvents.has(eventName)) {
    const providerSlug = typeof metadata.providerSlug === "string" ? metadata.providerSlug.slice(0, 100) : "";
    if (!providerSlug) return NextResponse.json({ ok: true });
    const provider = await database.query<{ id: string }>(
      `SELECT p.id::text FROM provider_profiles p
       WHERE lower(p.public_profile_slug) = lower($1) AND p.is_active = true AND p.public_profile_visible = true
         AND EXISTS (SELECT 1 FROM services s WHERE s.provider_id = p.id AND s.is_active = true) LIMIT 1`,
      [providerSlug],
    );
    if (!provider.rows[0]) return NextResponse.json({ ok: true });
    targetType = "provider";
    targetId = provider.rows[0].id;
    metadata = { method: providerShareEvents.get(eventName) };
  }
  await recordAnalytics({ eventName, userId: session?.user.id, anonymousId, path, targetType, targetId, metadata });
  return NextResponse.json({ ok: true });
}
