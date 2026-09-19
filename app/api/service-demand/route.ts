import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { recordAnalytics } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/request-security";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const serviceNeeded = typeof body.serviceNeeded === "string" ? body.serviceNeeded.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "";
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 120) : "";
  const radiusMiles = Number(body.radiusMiles);
  const consent = body.consent === true;

  if (!emailPattern.test(email) || serviceNeeded.length < 2 || serviceNeeded.length > 160 || !location || !Number.isInteger(radiusMiles) || radiusMiles < 1 || radiusMiles > 250 || !consent) {
    return NextResponse.json({ error: "Add a valid email, describe the service, and confirm that we may contact you." }, { status: 400 });
  }
  if (!await enforceRateLimit({ request, userId: email, bucket: "service-demand", limit: 5, windowSeconds: 3600 })) {
    return NextResponse.json({ error: "You have already sent several requests. Please try again later." }, { status: 429 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const result = await database.query<{ id: string }>(
    `INSERT INTO service_demand_requests (user_id, email, service_needed, category, location, radius_miles, consented_at)
     VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, now()) RETURNING id::text`,
    [session?.user.id ?? null, email, serviceNeeded, category, location, radiusMiles],
  );
  await recordAnalytics({ eventName: "service_demand_captured", userId: session?.user.id, targetType: "service_demand", targetId: result.rows[0].id, metadata: { category, location, radiusMiles } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
