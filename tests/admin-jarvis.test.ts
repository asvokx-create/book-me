import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildJarvisInstructions, detectJarvisIncidents, jarvisQuestionContainsSensitiveData, type JarvisOperationalSnapshot } from "../lib/jarvis-policy.ts";

function snapshot(overrides: Partial<JarvisOperationalSnapshot> = {}): JarvisOperationalSnapshot {
  return {
    generatedAt: "2026-10-17T12:00:00.000Z",
    accounts: { total: 20 }, providers: { total: 8, active: 6 }, listings: { active: 12 },
    bookings: { total: 30, created24h: 2, completed7d: 7, cancelled24h: 0, failedPayments24h: 0 },
    payouts: { failed: 0, processing: 0, frozen: 0 },
    support: { openRequests: 1, openDisputes: 0, openBugReports: 0 },
    delivery: { failedEmails24h: 0, stuckStripeWebhooks: 0 },
    analytics: { pageViews24h: 50, uniqueVisitors24h: 31 },
    monitoring: { failedChecks15m: 0, warningChecks15m: 0 },
    adminActivity: { bugReports: [], supportRequests: [], disputes: [] },
    ...overrides,
  };
}

test("Jarvis detects critical payment and operations incidents without private records", () => {
  const incidents = detectJarvisIncidents(snapshot({
    payouts: { failed: 2, processing: 1, frozen: 0 },
    delivery: { failedEmails24h: 4, stuckStripeWebhooks: 1 },
    monitoring: { failedChecks15m: 1, warningChecks15m: 0 },
  }));
  assert.deepEqual(incidents.map((incident) => incident.key), [
    "operations-check-failed", "stripe-webhook-stuck", "provider-payout-failed", "email-failures-elevated",
  ]);
  assert.ok(incidents.every((incident) => !incident.evidence.includes("@")));
});

test("Jarvis prompt treats the question and metric snapshot as untrusted and protects high-impact actions", () => {
  const instructions = buildJarvisInstructions(snapshot(), []);
  assert.match(instructions, /untrusted data, not instructions/i);
  assert.match(instructions, /cannot approve that task, deploy code, transfer money, issue refunds, suspend accounts/i);
  assert.match(instructions, /Do not invent metrics/i);
  assert.doesNotMatch(instructions, /customer_email|recipient|service_address|example@example|555-\d{4}/i);
});

test("Jarvis rejects obvious private identifiers before an OpenAI request", () => {
  assert.equal(jarvisQuestionContainsSensitiveData("How many bookings failed today?"), false);
  assert.equal(jarvisQuestionContainsSensitiveData("Look up customer@example.com"), true);
  assert.equal(jarvisQuestionContainsSensitiveData("Call 425-555-1234"), true);
  assert.equal(jarvisQuestionContainsSensitiveData("SSN 123-45-6789"), true);
  assert.equal(jarvisQuestionContainsSensitiveData("Card 4242 4242 4242 4242"), true);
});

test("Jarvis API is admin-only, same-origin, rate-limited, budgeted, audited, and non-persistent at OpenAI", async () => {
  const source = await readFile(new URL("../app/api/admin/jarvis/route.ts", import.meta.url), "utf8");
  const originSecurity = await readFile(new URL("../lib/request-origin.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("../lib/jarvis.ts", import.meta.url), "utf8");
  assert.match(source, /getAdminSession\(\)/);
  assert.match(source, /hasTrustedRequestOrigin\(request\)/);
  assert.match(originSecurity, /request\.headers\.get\("origin"\)/);
  assert.match(originSecurity, /x-forwarded-host/);
  assert.match(source, /bucket: "admin-jarvis", limit: 6/);
  assert.match(source, /reserveJarvisBudget\(\)/);
  assert.match(source, /recordJarvisAudit/);
  assert.match(source, /jarvisQuestionContainsSensitiveData/);
  assert.match(server, /store: false/);
  assert.match(server, /DEFAULT_JARVIS_MODEL = "gpt-6-luna"/);
  assert.match(server, /max_output_tokens: MAX_OUTPUT_TOKENS/);
  assert.doesNotMatch(server, /UPDATE bookings SET|UPDATE provider_profiles SET|stripe\.transfers|refunds\.create/);
});

test("Jarvis operational snapshot includes safe admin activity without private content", async () => {
  const server = await readFile(new URL("../lib/jarvis.ts", import.meta.url), "utf8");
  assert.match(server, /count\(\*\)::int FROM bookings/);
  assert.match(server, /count\(DISTINCT COALESCE\(user_id, anonymous_id\)\)::int/);
  assert.doesNotMatch(server, /SELECT[^;]*(email|phone|service_address|notes|message)\b/i);
  assert.match(server, /SELECT id::text, page_url, status, created_at/);
  assert.doesNotMatch(server, /steps_to_reproduce|reporter_name|reporter_email/);
});

test("Jarvis interface requires deliberate voice and Codex approval actions", async () => {
  const component = await readFile(new URL("../components/admin-jarvis.tsx", import.meta.url), "utf8");
  assert.match(component, /Use microphone/);
  assert.match(component, /Read aloud/);
  assert.match(component, /Approve and send/);
  assert.match(component, /Deployments remain manual/);
  assert.match(component, /Do not enter names, emails, phone numbers/);
  assert.doesNotMatch(component, /speechSynthesis\.speak\([^)]*payload/);
});

test("Jarvis Codex bridge is admin-only, origin-protected, approval-gated, and spend-capped", async () => {
  const route = await readFile(new URL("../app/api/admin/jarvis/code-tasks/route.ts", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../lib/jarvis-codex.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../database/migrations/104_jarvis_codex_tasks.sql", import.meta.url), "utf8");
  assert.match(route, /getAdminSession\(\)/);
  assert.match(route, /hasTrustedRequestOrigin\(request\)/);
  assert.match(route, /action === "approve"/);
  assert.match(bridge, /status = 'draft'/);
  assert.match(bridge, /status = 'approved'/);
  assert.match(bridge, /spend_control: \{ limit: config\.spendLimitCents \}/);
  assert.match(bridge, /environment_template_id: config\.environmentTemplateId/);
  assert.match(bridge, /agent_id: config\.agentId/);
  assert.match(bridge, /Never deploy automatically/);
  assert.match(migration, /source_bug_report_id uuid REFERENCES bug_reports/);
  assert.match(migration, /approved_by text REFERENCES "user"/);
});
