import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { approveAndDispatchJarvisCodexTask, cancelJarvisCodexTask, createJarvisCodexTask, jarvisCodexConfiguration, listJarvisCodexTasks } from "@/lib/jarvis-codex";
import { enforceRateLimit } from "@/lib/request-security";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const config = jarvisCodexConfiguration();
  return NextResponse.json({ tasks: await listJarvisCodexTasks(), configured: config.configured });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "jarvis-code-task", limit: 10, windowSeconds: 60 })) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { title?: unknown; description?: unknown; bugReportId?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 160) : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 5_000) : "";
  const bugReportId = typeof body?.bugReportId === "string" ? body.bugReportId.trim() : "";
  if (title.length < 3 || description.length < 10 || (bugReportId && !/^[0-9a-f-]{36}$/i.test(bugReportId))) {
    return NextResponse.json({ error: "Add a clear title and at least 10 characters of detail." }, { status: 400 });
  }
  try {
    const task = await createJarvisCodexTask({ actorUserId: session.user.id, title, description, sourceBugReportId: bugReportId || null });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const duplicate = error instanceof Error && /duplicate key|unique/i.test(error.message);
    return NextResponse.json({ error: duplicate ? "An open Codex task already exists for that bug." : "The Codex task could not be created." }, { status: duplicate ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "jarvis-code-task-action", limit: 6, windowSeconds: 60 })) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action === "approve" || body?.action === "cancel" ? body.action : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !action) return NextResponse.json({ error: "Choose a valid task action." }, { status: 400 });
  try {
    if (action === "cancel") {
      await cancelJarvisCodexTask(id, session.user.id);
      return NextResponse.json({ ok: true });
    }
    const task = await approveAndDispatchJarvisCodexTask(id, session.user.id);
    return NextResponse.json({ task });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "CODEX_NOT_CONFIGURED") return NextResponse.json({ error: "Codex is not connected yet. Add the approved Codex environment setting first." }, { status: 503 });
    if (code === "TASK_NOT_DRAFT" || code === "TASK_NOT_CANCELLABLE") return NextResponse.json({ error: "That task has already changed. Refresh and try again." }, { status: 409 });
    return NextResponse.json({ error: "Codex could not start this task. No deployment or production change occurred." }, { status: 502 });
  }
}
