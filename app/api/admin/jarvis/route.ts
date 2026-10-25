import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { askJarvis, jarvisConfiguration, recordJarvisAudit, releaseJarvisBudget, reserveJarvisBudget, settleJarvisBudget, type JarvisConversationTurn } from "@/lib/jarvis";
import { enforceRateLimit } from "@/lib/request-security";
import { hasTrustedRequestOrigin } from "@/lib/request-origin";
import { jarvisQuestionContainsSensitiveData } from "@/lib/jarvis-policy";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const config = jarvisConfiguration();
  return NextResponse.json({ configured: config.configured, readOnly: true });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-jarvis", limit: 6, windowSeconds: 60 })) {
    return NextResponse.json({ error: "Jarvis is receiving too many requests. Please wait a minute." }, { status: 429 });
  }

  let question = "";
  let history: JarvisConversationTurn[] = [];
  try {
    const body = await request.json() as { question?: unknown; history?: unknown };
    question = typeof body.question === "string" ? body.question.trim() : "";
    if (Array.isArray(body.history)) {
      history = body.history.slice(-8).flatMap((item): JarvisConversationTurn[] => {
        if (!item || typeof item !== "object") return [];
        const turn = item as { role?: unknown; text?: unknown };
        if ((turn.role !== "admin" && turn.role !== "jarvis") || typeof turn.text !== "string") return [];
        const text = turn.text.trim().slice(0, 2_000);
        return text ? [{ role: turn.role, text }] : [];
      });
    }
  } catch {
    return NextResponse.json({ error: "Send a valid question." }, { status: 400 });
  }
  if (question.length < 2 || question.length > 1_000) {
    return NextResponse.json({ error: "Questions must be between 2 and 1,000 characters." }, { status: 400 });
  }

  const requestId = randomUUID();
  if (jarvisQuestionContainsSensitiveData(question) || history.some((turn) => turn.role === "admin" && jarvisQuestionContainsSensitiveData(turn.text))) {
    await recordJarvisAudit({ requestId, userId: session.user.id, question, status: "rejected", errorCode: "sensitive_input" });
    return NextResponse.json({ error: "Remove email addresses, phone numbers, government identifiers, or payment-card numbers. Jarvis only needs aggregate operational questions." }, { status: 400 });
  }
  const config = jarvisConfiguration();
  if (!config.configured) {
    await recordJarvisAudit({ requestId, userId: session.user.id, question, status: "rejected", errorCode: "not_configured" });
    return NextResponse.json({ error: "Jarvis is not configured yet. Add the server-only OpenAI settings before using it." }, { status: 503 });
  }
  if (!await reserveJarvisBudget()) {
    await recordJarvisAudit({ requestId, userId: session.user.id, question, model: config.model, status: "rejected", errorCode: "daily_budget_reached" });
    return NextResponse.json({ error: "Jarvis reached its daily usage limit. Try again after the UTC usage window resets." }, { status: 429 });
  }

  try {
    const result = await askJarvis(question, history);
    await settleJarvisBudget(result.inputTokens, result.outputTokens);
    await recordJarvisAudit({ requestId, userId: session.user.id, question, model: result.model, status: "completed", inputTokens: result.inputTokens, outputTokens: result.outputTokens });
    return NextResponse.json({ answer: result.answer, incidents: result.incidents, generatedAt: result.generatedAt, requestId });
  } catch (error) {
    await releaseJarvisBudget();
    const code = error instanceof Error ? error.message : "UNKNOWN";
    await recordJarvisAudit({ requestId, userId: session.user.id, question, model: config.model, status: "failed", errorCode: code.slice(0, 80) });
    console.error("Jarvis request failed", { requestId, code });
    const message = code === "UPSTREAM_RATE_LIMIT"
      ? "The AI service is temporarily rate limited. Please try again shortly."
      : "Jarvis could not answer that question right now. No operational action was taken.";
    return NextResponse.json({ error: message, requestId }, { status: code === "UPSTREAM_RATE_LIMIT" ? 429 : 502 });
  }
}
