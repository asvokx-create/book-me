import { NextResponse } from "next/server";
import { runJarvisIncidentAlerts } from "@/lib/jarvis-phone";
import { secureSecretMatches } from "@/lib/request-security";

export async function POST(request: Request) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secureSecretMatches(process.env.CRON_SECRET, supplied)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ ok: true, alerts: await runJarvisIncidentAlerts() });
}
