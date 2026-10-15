import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit, publicRequestRateLimitKey } from "@/lib/request-security";

const cookieName = "bb_growth_campaign";
function text(value: unknown) { return typeof value === "string" ? value.trim().slice(0, 160) || null : null; }
function cookieValue(header: string | null) { for (const part of (header ?? "").split(";")) { const [name, ...value] = part.trim().split("="); if (name === cookieName) return value.join("="); } return null; }
function path(value: unknown) { const candidate = typeof value === "string" ? value.slice(0, 500) : "/"; return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/"; }

export async function POST(request: Request) {
  if (!await enforceRateLimit({ request, userId: publicRequestRateLimitKey(request), bucket: "growth-attribution", limit: 20 })) return NextResponse.json({ error: "Too many campaign attribution requests." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const source = text(body?.utmSource), medium = text(body?.utmMedium), campaign = text(body?.utmCampaign), content = text(body?.utmContent), term = text(body?.utmTerm);
  if (!source && !medium && !campaign && !content && !term) return NextResponse.json({ ok: true, ignored: true });
  const existing = cookieValue(request.headers.get("cookie"));
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return NextResponse.json({ ok: true, retained: true });
  const token = randomUUID();
  await database.query(`INSERT INTO growth_campaign_attributions(attribution_token,landing_path,utm_source,utm_medium,utm_campaign,utm_content,utm_term) VALUES($1::uuid,$2,$3,$4,$5,$6,$7)`, [token, path(body?.landingPath), source, medium, campaign, content, term]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 90 * 86_400 });
  return response;
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ ok: true });
  const token = cookieValue(request.headers.get("cookie"));
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return NextResponse.json({ ok: true });
  await database.query(`UPDATE growth_campaign_attributions SET attributed_user_id=$2,attributed_at=COALESCE(attributed_at,now()) WHERE attribution_token=$1::uuid AND attributed_user_id IS NULL`, [token, session.user.id]);
  return NextResponse.json({ ok: true });
}
