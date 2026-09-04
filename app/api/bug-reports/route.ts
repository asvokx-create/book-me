import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkAndRecordContent } from "@/lib/content-safety";
import { database } from "@/lib/database";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to report a bug." }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  const steps = typeof body.steps === "string" ? body.steps.trim() : "";
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 1000) : "";
  if (title.length < 5 || title.length > 120 || details.length < 10 || details.length > 2000 || steps.length > 2000) {
    return NextResponse.json({ error: "Add a short title and describe the problem." }, { status: 400 });
  }
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "bug_report", fields: [title, details, steps] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const result = await database.query<{ id: string }>(
    `INSERT INTO bug_reports (reporter_id, page_url, title, details, steps_to_reproduce)
     VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
    [session.user.id, pageUrl, title, details, steps],
  );
  return NextResponse.json({ ok: true, reportId: result.rows[0].id }, { status: 201 });
}
