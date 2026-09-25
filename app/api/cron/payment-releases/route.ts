import { NextResponse } from "next/server";
import { releaseDuePayouts } from "@/lib/payment-release";
import { secureSecretMatches } from "@/lib/request-security";
import { advanceAffiliateCommissions } from "@/lib/affiliates";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureSecretMatches(configuredSecret, suppliedSecret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const releases = await releaseDuePayouts();
  const affiliateCommissionsAdvanced = await advanceAffiliateCommissions();
  return NextResponse.json({ ok: true, ...releases, affiliateCommissionsAdvanced });
}
