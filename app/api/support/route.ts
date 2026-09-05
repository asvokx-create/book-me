import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to contact support." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "support-request", limit: 5 })) return NextResponse.json({ error: "Too many support messages. Please wait and try again." }, { status: 429 });
  const body = await request.json() as { subject?: unknown; message?: unknown };
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (subject.length < 4 || subject.length > 120 || message.length < 10 || message.length > 2000) return NextResponse.json({ error: "Add a subject and a message between 10 and 2,000 characters." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "support_request", fields: [subject, message] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const result = await database.query<{ id: string }>("INSERT INTO support_requests (user_id, subject, message) VALUES ($1, $2, $3) RETURNING id::text", [session.user.id, subject, message]);
  await recordActivity({ userId: session.user.id, action: "support_request_created", targetType: "support_request", targetId: result.rows[0].id });
  return NextResponse.json({ ok: true, id: result.rows[0].id });
}
