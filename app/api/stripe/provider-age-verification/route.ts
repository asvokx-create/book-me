import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { startProviderAgeVerification } from "@/lib/provider-age-verification";
import { enforceRateLimit } from "@/lib/request-security";
import { isStripeReady } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to verify provider eligibility." }, { status: 401 });
  if (!isStripeReady()) return NextResponse.json({ error: "Stripe verification is not available yet." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "provider-age-verification", limit: 6 })) {
    return NextResponse.json({ error: "Too many verification attempts. Please wait and try again." }, { status: 429 });
  }
  const provider = await database.query<{ id: string }>("SELECT id::text FROM provider_profiles WHERE user_id=$1 AND is_active=true", [session.user.id]);
  if (!provider.rows[0]) return NextResponse.json({ error: "Create your provider profile before verifying eligibility." }, { status: 404 });
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? request.url).origin;
    const result = await startProviderAgeVerification({ providerId: provider.rows[0].id, origin });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Provider age verification could not start", error);
    return NextResponse.json({ error: "We could not start provider age verification. Please try again." }, { status: 502 });
  }
}
