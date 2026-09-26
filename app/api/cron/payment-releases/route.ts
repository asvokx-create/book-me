import { NextResponse } from "next/server";
import { releaseDuePayouts } from "@/lib/payment-release";
import { secureSecretMatches } from "@/lib/request-security";
import { advanceAffiliateCommissions } from "@/lib/affiliates";
import { runAutomatedAffiliatePayouts, runProtectedOwnerPayout } from "@/lib/affiliate-payouts";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureSecretMatches(configuredSecret, suppliedSecret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const releases = await releaseDuePayouts();
  const affiliateCommissionsAdvanced = await advanceAffiliateCommissions();
  const affiliatePayouts = await runAutomatedAffiliatePayouts();
  const ownerPayout = await runProtectedOwnerPayout();
  return NextResponse.json({ ok: true, ...releases, affiliateCommissionsAdvanced, affiliatePayouts, ownerPayout });
}
