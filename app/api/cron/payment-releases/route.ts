import { NextResponse } from "next/server";
import { releaseDuePayouts } from "@/lib/payment-release";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await releaseDuePayouts()) });
}
