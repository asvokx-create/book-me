import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { startProviderAgeVerification } from "@/lib/provider-age-verification";
import { providerAgeVerificationError } from "@/lib/provider-age-verification-errors";
import { enforceRateLimit } from "@/lib/request-security";
import { isStripeReady } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to verify provider eligibility." }, { status: 401 });
  if (!isStripeReady()) return NextResponse.json({ error: "Age verification is temporarily unavailable. Please try again later." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "provider-age-verification", limit: 6 })) {
    return NextResponse.json({ error: "Too many age-verification attempts. Please wait a minute and try again." }, { status: 429 });
  }
  const provider = await database.query<{ id: string }>("SELECT id::text FROM provider_profiles WHERE user_id=$1 AND is_active=true", [session.user.id]);
  if (!provider.rows[0]) return NextResponse.json({ error: "Create your provider profile before starting age verification." }, { status: 404 });
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? request.url).origin;
    const result = await startProviderAgeVerification({ providerId: provider.rows[0].id, origin });
    if (result.url) return NextResponse.json({ url: result.url, status: result.status });
    if (result.status === "verified") return NextResponse.json({ status: result.status, verified: true });
    return NextResponse.json({ status: result.status, error: "Stripe is still reviewing your age verification. Check again shortly." }, { status: 409 });
  } catch (error) {
    const failure = providerAgeVerificationError(error);
    console.error("Provider age verification could not start", { code: failure.code ?? "unknown" });
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
