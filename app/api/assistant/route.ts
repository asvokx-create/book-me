import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin";
import { checkAndRecordContent } from "@/lib/content-safety";
import { database } from "@/lib/database";
import type { ProviderPlan } from "@/lib/plans";
import { PLAN_ENTITLEMENTS } from "@/lib/plans";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

async function access() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { session: null, eligible: false, plan: null as ProviderPlan | null };
  if (await hasAdminAccess(session.user.id, session.user.email)) return { session, eligible: true, plan: "business" as const };
  const result = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE user_id = $1 AND is_active = true", [session.user.id]);
  const plan = result.rows[0]?.plan ?? null;
  return { session, eligible: plan ? PLAN_ENTITLEMENTS[plan].aiAssistant : false, plan };
}

export async function GET() {
  const result = await access();
  if (!result.session) return NextResponse.json({ signedIn: false, eligible: false });
  return NextResponse.json({ signedIn: true, eligible: result.eligible, plan: result.plan, configured: Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(request: Request) {
  const result = await access();
  if (!result.session) return NextResponse.json({ error: "Log in to use BookMe AI." }, { status: 401 });
  if (!result.eligible) return NextResponse.json({ error: "BookMe AI is included with Pro and Business provider plans." }, { status: 403 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "BookMe AI is being configured. Please try again later." }, { status: 503 });
  if (!await enforceRateLimit({ request, userId: result.session.user.id, bucket: "ai-assistant", limit: 12 })) {
    return NextResponse.json({ error: "You have reached the AI help limit for this minute. Please try again shortly." }, { status: 429 });
  }
  const body = (await request.json()) as { message?: unknown; history?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 2 || message.length > 1000) return NextResponse.json({ error: "Ask a question in 2–1,000 characters." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: result.session.user.id, surface: "ai_assistant", fields: [message] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const history = Array.isArray(body.history) ? body.history.slice(-8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as { role?: unknown; content?: unknown };
    if ((entry.role !== "user" && entry.role !== "assistant") || typeof entry.content !== "string") return [];
    return [{ role: entry.role, content: entry.content.slice(0, 1500) }];
  }) : [];
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        instructions: "You are BookMe AI, a concise support assistant for a local-services marketplace. Help users understand BookMe navigation, listings, schedules, bookings, teams, plans, disputes, reports, and account settings. Never claim to change an account or booking. Never request passwords, payment-card details, authentication codes, or sensitive personal information. For emergencies or threats, tell the user to contact local emergency services and use BookMe's Report feature. For disputes, direct them to /disputes. Be clear that payments are not yet active when relevant.",
        input: [...history, { role: "user", content: message }],
        max_output_tokens: 450,
        store: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
    if (!response.ok) {
      console.error("OpenAI response failed", response.status, data.error?.message);
      return NextResponse.json({ error: "BookMe AI could not answer right now." }, { status: 502 });
    }
    const answer = data.output?.flatMap((item) => item.content ?? []).filter((part) => part.type === "output_text").map((part) => part.text ?? "").join("\n").trim();
    if (!answer) return NextResponse.json({ error: "BookMe AI did not return an answer." }, { status: 502 });
    await recordActivity({ userId: result.session.user.id, action: "ai_assistant_used", targetType: "assistant" });
    return NextResponse.json({ answer });
  } catch (error) {
    console.error("BookMe AI request failed", error);
    return NextResponse.json({ error: "BookMe AI could not answer right now." }, { status: 502 });
  }
}
