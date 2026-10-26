import { NextResponse } from "next/server";
import { AFFILIATE_COOKIE } from "@/lib/affiliates";
import { cookieValue, storeAffiliateAttribution } from "@/lib/affiliate-attribution-store";
import { enforceRateLimit, publicRequestRateLimitKey } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!await enforceRateLimit({ request, userId: publicRequestRateLimitKey(request), bucket: "affiliate-click", limit: 30 })) {
    return NextResponse.json({ error: "Too many referral requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const result = await storeAffiliateAttribution({
    ...(body ?? {}),
    code: body?.code,
    landingPath: body?.landingPath,
    userAgent: request.headers.get("user-agent"),
    savedToken: cookieValue(request.headers.get("cookie"), AFFILIATE_COOKIE),
  });
  if (result.status === "invalid") {
    return NextResponse.json({ error: result.code ? "That referral code is not active." : "Enter a referral code." }, { status: result.code ? 404 : 400 });
  }
  if (result.status === "retained") return NextResponse.json({ ok: true, code: result.code, retained: true });

  const response = NextResponse.json({ ok: true, code: result.code });
  response.cookies.set(AFFILIATE_COOKIE, result.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: result.maxAge,
  });
  return response;
}
