import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { AFFILIATE_COOKIE, newAttributionToken, normalizeAffiliateCode, safeInternalDestination } from "@/lib/affiliates";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const anonymousKey = request.headers.get("do-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("user-agent") ?? "anonymous";
  if (!await enforceRateLimit({ request, userId: anonymousKey, bucket: "affiliate-click", limit: 30 })) {
    return NextResponse.json({ error: "Too many referral requests." }, { status: 429 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const code = normalizeAffiliateCode(body.code);
  if (!code) return NextResponse.json({ error: "Enter a referral code." }, { status: 400 });
  const affiliate = await database.query<{ affiliate_id: string; program_id: string; attribution_window_days: number }>(
    `SELECT affiliate.id::text AS affiliate_id, program.id::text AS program_id, program.attribution_window_days
     FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id = affiliate.program_id
     WHERE lower(affiliate.affiliate_code) = lower($1) AND affiliate.status = 'active'
       AND program.status = 'enabled' AND (program.starts_at IS NULL OR program.starts_at <= now())
       AND (program.ends_at IS NULL OR program.ends_at > now()) LIMIT 1`, [code],
  );
  const match = affiliate.rows[0];
  if (!match) return NextResponse.json({ error: "That referral code is not active." }, { status: 404 });
  const token = newAttributionToken();
  await database.query(`INSERT INTO affiliate_clicks (affiliate_id, program_id, attribution_token, affiliate_code, landing_path,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term)
    VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10)`, [match.affiliate_id, match.program_id, token, code,
    safeInternalDestination(body.landingPath), text(body.utmSource), text(body.utmMedium), text(body.utmCampaign), text(body.utmContent), text(body.utmTerm)]);
  const response = NextResponse.json({ ok: true, code });
  response.cookies.set(AFFILIATE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: match.attribution_window_days * 86_400,
  });
  return response;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 160) || null : null;
}
