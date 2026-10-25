import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { database } from "@/lib/database";
import { buildJarvisInstructions, detectJarvisIncidents, type JarvisOperationalSnapshot } from "@/lib/jarvis-policy";

const DEFAULT_DAILY_REQUEST_LIMIT = 100;
const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
const DEFAULT_JARVIS_MODEL = "gpt-6-luna";
const TOKEN_RESERVATION = 2_500;
const MAX_OUTPUT_TOKENS = 600;

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function jarvisConfiguration() {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: process.env.JARVIS_OPENAI_MODEL?.trim() || DEFAULT_JARVIS_MODEL,
    dailyRequestLimit: boundedInteger(process.env.JARVIS_DAILY_REQUEST_LIMIT, DEFAULT_DAILY_REQUEST_LIMIT, 1, 1_000),
    dailyTokenLimit: boundedInteger(process.env.JARVIS_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_TOKEN_LIMIT, 10_000, 5_000_000),
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safePagePath(value: unknown) {
  try {
    const url = new URL(String(value ?? ""), "https://bubsbookings.com");
    return url.hostname === "bubsbookings.com" || url.hostname === "www.bubsbookings.com" ? url.pathname.slice(0, 300) : "";
  } catch {
    return "";
  }
}

export async function getJarvisOperationalSnapshot(): Promise<JarvisOperationalSnapshot> {
  const [result, bugs, support, disputes] = await Promise.all([
    database.query<Record<string, unknown>>(`SELECT
    (SELECT count(*)::int FROM "user") AS total_accounts,
    (SELECT count(*)::int FROM provider_profiles) AS total_providers,
    (SELECT count(*)::int FROM provider_profiles WHERE is_active = true) AS active_providers,
    (SELECT count(*)::int FROM services WHERE is_active = true) AS active_listings,
    (SELECT count(*)::int FROM bookings) AS total_bookings,
    (SELECT count(*)::int FROM bookings WHERE created_at >= now() - interval '24 hours') AS bookings_24h,
    (SELECT count(*)::int FROM bookings WHERE status = 'completed' AND updated_at >= now() - interval '7 days') AS completed_7d,
    (SELECT count(*)::int FROM bookings WHERE status = 'cancelled' AND updated_at >= now() - interval '24 hours') AS cancelled_24h,
    (SELECT count(*)::int FROM bookings WHERE payment_status = 'failed' AND updated_at >= now() - interval '24 hours') AS failed_payments_24h,
    (SELECT count(*)::int FROM bookings WHERE payment_release_status = 'failed') AS failed_payouts,
    (SELECT count(*)::int FROM bookings WHERE payment_release_status = 'processing') AS processing_payouts,
    (SELECT count(*)::int FROM bookings WHERE payment_release_status = 'frozen') AS frozen_payouts,
    (SELECT count(*)::int FROM support_requests WHERE status IN ('open', 'reviewing')) AS open_support,
    (SELECT count(*)::int FROM booking_disputes WHERE status IN ('open', 'reviewing')) AS open_disputes,
    (SELECT count(*)::int FROM bug_reports WHERE status IN ('open', 'reviewing')) AS open_bugs,
    (SELECT count(*)::int FROM email_delivery_log WHERE status = 'failed' AND created_at >= now() - interval '24 hours') AS failed_emails_24h,
    (SELECT count(*)::int FROM stripe_webhook_events WHERE status = 'processing' AND created_at < now() - interval '10 minutes') AS stuck_webhooks,
    (SELECT count(*)::int FROM analytics_events WHERE event_name = 'page_view' AND created_at >= now() - interval '24 hours') AS page_views_24h,
    (SELECT count(DISTINCT COALESCE(user_id, anonymous_id))::int FROM analytics_events WHERE event_name = 'page_view' AND created_at >= now() - interval '24 hours') AS unique_visitors_24h,
    (SELECT count(*)::int FROM operations_checks WHERE status = 'failed' AND created_at >= now() - interval '15 minutes') AS failed_checks_15m,
    (SELECT count(*)::int FROM operations_checks WHERE status = 'warning' AND created_at >= now() - interval '15 minutes') AS warning_checks_15m`),
    database.query<Record<string, unknown>>(`SELECT id::text, page_url, status, created_at
      FROM bug_reports ORDER BY created_at DESC LIMIT 25`),
    database.query<Record<string, unknown>>(`SELECT id::text, status, created_at
      FROM support_requests ORDER BY created_at DESC LIMIT 15`),
    database.query<Record<string, unknown>>(`SELECT id::text, category, status, created_at
      FROM booking_disputes ORDER BY created_at DESC LIMIT 15`),
  ]);
  const row = result.rows[0] ?? {};
  return {
    generatedAt: new Date().toISOString(),
    accounts: { total: numberValue(row.total_accounts) },
    providers: { total: numberValue(row.total_providers), active: numberValue(row.active_providers) },
    listings: { active: numberValue(row.active_listings) },
    bookings: {
      total: numberValue(row.total_bookings), created24h: numberValue(row.bookings_24h),
      completed7d: numberValue(row.completed_7d), cancelled24h: numberValue(row.cancelled_24h),
      failedPayments24h: numberValue(row.failed_payments_24h),
    },
    payouts: { failed: numberValue(row.failed_payouts), processing: numberValue(row.processing_payouts), frozen: numberValue(row.frozen_payouts) },
    support: { openRequests: numberValue(row.open_support), openDisputes: numberValue(row.open_disputes), openBugReports: numberValue(row.open_bugs) },
    delivery: { failedEmails24h: numberValue(row.failed_emails_24h), stuckStripeWebhooks: numberValue(row.stuck_webhooks) },
    analytics: { pageViews24h: numberValue(row.page_views_24h), uniqueVisitors24h: numberValue(row.unique_visitors_24h) },
    monitoring: { failedChecks15m: numberValue(row.failed_checks_15m), warningChecks15m: numberValue(row.warning_checks_15m) },
    adminActivity: {
      bugReports: bugs.rows.map((record) => ({
        id: String(record.id), kind: "bug" as const, status: String(record.status),
        pagePath: safePagePath(record.page_url), createdAt: new Date(String(record.created_at)).toISOString(),
      })),
      supportRequests: support.rows.map((record) => ({
        id: String(record.id), kind: "support" as const, status: String(record.status),
        createdAt: new Date(String(record.created_at)).toISOString(),
      })),
      disputes: disputes.rows.map((record) => ({
        id: String(record.id), kind: "dispute" as const, status: String(record.status),
        category: String(record.category), createdAt: new Date(String(record.created_at)).toISOString(),
      })),
    },
  };
}

export async function reserveJarvisBudget() {
  const config = jarvisConfiguration();
  const result = await database.query(`INSERT INTO jarvis_daily_usage
      (usage_date, request_count, reserved_tokens, input_tokens, output_tokens)
    VALUES ((now() AT TIME ZONE 'UTC')::date, 1, $1, 0, 0)
    ON CONFLICT (usage_date) DO UPDATE SET
      request_count = jarvis_daily_usage.request_count + 1,
      reserved_tokens = jarvis_daily_usage.reserved_tokens + $1,
      updated_at = now()
    WHERE jarvis_daily_usage.request_count < $2
      AND jarvis_daily_usage.input_tokens + jarvis_daily_usage.output_tokens + jarvis_daily_usage.reserved_tokens + $1 <= $3
    RETURNING usage_date`, [TOKEN_RESERVATION, config.dailyRequestLimit, config.dailyTokenLimit]);
  return result.rowCount === 1;
}

export async function settleJarvisBudget(inputTokens: number, outputTokens: number) {
  await database.query(`UPDATE jarvis_daily_usage SET
      reserved_tokens = greatest(0, reserved_tokens - $1),
      input_tokens = input_tokens + $2,
      output_tokens = output_tokens + $3,
      updated_at = now()
    WHERE usage_date = (now() AT TIME ZONE 'UTC')::date`, [TOKEN_RESERVATION, inputTokens, outputTokens]);
}

export async function releaseJarvisBudget() {
  await database.query(`UPDATE jarvis_daily_usage SET reserved_tokens = greatest(0, reserved_tokens - $1), updated_at = now()
    WHERE usage_date = (now() AT TIME ZONE 'UTC')::date`, [TOKEN_RESERVATION]);
}

type OpenAIResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

export type JarvisConversationTurn = { role: "admin" | "jarvis"; text: string };

function responseText(payload: OpenAIResponse) {
  return (payload.output ?? []).flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim()).filter(Boolean).join("\n").slice(0, 8_000);
}

export async function askJarvis(question: string, history: JarvisConversationTurn[] = []) {
  const config = jarvisConfiguration();
  if (!config.configured) throw new Error("NOT_CONFIGURED");
  const snapshot = await getJarvisOperationalSnapshot();
  const incidents = detectJarvisIncidents(snapshot);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      instructions: buildJarvisInstructions(snapshot, incidents),
      input: [
        ...history.slice(-8).map((turn) => ({
          role: turn.role === "admin" ? "user" : "assistant",
          content: turn.text.slice(0, 2_000),
        })),
        { role: "user", content: question },
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() as OpenAIResponse : null;
  if (!response.ok || !payload) throw new Error(response.status === 429 ? "UPSTREAM_RATE_LIMIT" : "UPSTREAM_ERROR");
  const answer = responseText(payload);
  if (!answer) throw new Error("EMPTY_RESPONSE");
  return {
    answer,
    incidents,
    generatedAt: snapshot.generatedAt,
    model: config.model,
    inputTokens: Math.max(0, payload.usage?.input_tokens ?? 0),
    outputTokens: Math.max(0, payload.usage?.output_tokens ?? 0),
  };
}

export async function recordJarvisAudit(input: {
  requestId?: string; userId: string; question: string; model?: string;
  status: "completed" | "rejected" | "failed"; inputTokens?: number; outputTokens?: number; errorCode?: string;
}) {
  const requestId = input.requestId ?? randomUUID();
  await database.query(`INSERT INTO jarvis_audit_log
      (request_id, actor_user_id, question_hash, question_length, model, status, input_tokens, output_tokens, error_code)
    VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`, [
    requestId, input.userId, createHash("sha256").update(input.question).digest("hex"), input.question.length,
    input.model ?? "", input.status, input.inputTokens ?? 0, input.outputTokens ?? 0, input.errorCode ?? null,
  ]);
  return requestId;
}
