import { NextResponse } from "next/server";
import {
  POLICY_CONSENT_COOKIE,
  createPolicyConsentAttestation,
  policyConsentCookieOptions,
} from "@/lib/policy-consent-attestation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    termsAccepted?: unknown;
    privacyAcknowledged?: unknown;
  } | null;
  if (body?.termsAccepted !== true || body?.privacyAcknowledged !== true) {
    return NextResponse.json({ error: "Accept the required agreements before continuing." }, { status: 400 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(POLICY_CONSENT_COOKIE, createPolicyConsentAttestation(), policyConsentCookieOptions);
  return response;
}
