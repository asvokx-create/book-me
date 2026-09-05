import { NextResponse } from "next/server";
import { runBookingReminders } from "@/lib/booking-reminders";

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!configuredSecret || suppliedSecret !== configuredSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = await runBookingReminders();
  if (!result.configured) return NextResponse.json({ error: "Transactional email is not configured." }, { status: 503 });
  return NextResponse.json({ ok: true, processed: result.processed });
}
