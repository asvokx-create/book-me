import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { runAutomatedProviderVerification } from "@/lib/provider-verification";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "automatic-verification", limit: 6 }))
    return NextResponse.json({ error: "Please wait before running another verification check." }, { status: 429 });
  const provider = await database.query<{ id: string }>("SELECT id::text FROM provider_profiles WHERE user_id = $1", [session.user.id]);
  if (!provider.rows[0]) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const result = await runAutomatedProviderVerification(provider.rows[0].id);
  return NextResponse.json({ result });
}
