import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await request.json() as { cancellationWindowHours?: unknown; cancellationPolicy?: unknown; noShowPolicy?: unknown };
  const hours = Number(body.cancellationWindowHours);
  const policy = typeof body.cancellationPolicy === "string" ? body.cancellationPolicy.trim() : "";
  const noShowPolicy = typeof body.noShowPolicy === "string" ? body.noShowPolicy.trim() : "";
  if (!Number.isInteger(hours) || hours < 0 || hours > 168 || policy.length < 10 || policy.length > 500 || noShowPolicy.length < 10 || noShowPolicy.length > 500) return NextResponse.json({ error: "Choose a valid notice window and keep both policies between 10 and 500 characters." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "provider_policy", fields: [policy, noShowPolicy] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const result = await database.query("UPDATE provider_profiles SET cancellation_window_hours = $1, cancellation_policy = $2, no_show_policy = $3 WHERE user_id = $4", [hours, policy, noShowPolicy, session.user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
