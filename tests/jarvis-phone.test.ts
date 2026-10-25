import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { computeTwilioSignature, constantTimeTextEqual, incidentFingerprint, incidentMeetsThreshold, isE164PhoneNumber, isInsideApprovedCallingHours, safeVoiceAlertText } from "../lib/jarvis-phone-policy.ts";

const settings = { outboundAlertsEnabled: true, minimumSeverity: "critical" as const, quietHoursStart: 21, quietHoursEnd: 7, timeZone: "America/Los_Angeles" };
const incident = { key: "stripe-webhook-stuck", severity: "critical" as const, title: "Stripe webhook is stuck <script>", evidence: "1 event & private work" };

test("Jarvis phone validates E.164 destinations and severity thresholds", () => {
  assert.equal(isE164PhoneNumber("+14255550123"), true);
  assert.equal(isE164PhoneNumber("425-555-0123"), false);
  assert.equal(incidentMeetsThreshold("critical", "critical"), true);
  assert.equal(incidentMeetsThreshold("high", "critical"), false);
  assert.equal(incidentMeetsThreshold("medium", "high"), false);
});

test("Twilio form signatures are deterministic, parameter-ordered, and compared safely", () => {
  const url = "https://bubsbookings.com/api/jarvis/twilio/voice";
  const first = new URLSearchParams({ To: "+14255550100", CallSid: "CA123", From: "+14255550101" });
  const reordered = new URLSearchParams({ From: "+14255550101", To: "+14255550100", CallSid: "CA123" });
  const signature = computeTwilioSignature("test-auth-token", url, first);
  assert.equal(signature, computeTwilioSignature("test-auth-token", url, reordered));
  assert.equal(constantTimeTextEqual(signature, signature), true);
  assert.equal(constantTimeTextEqual(signature, `${signature}x`), false);
});

test("Jarvis incident calls honor Pacific quiet hours", () => {
  assert.equal(isInsideApprovedCallingHours(new Date("2026-10-17T19:00:00.000Z"), settings), true);
  assert.equal(isInsideApprovedCallingHours(new Date("2026-10-18T05:00:00.000Z"), settings), false);
});

test("Jarvis alert deduplication is deterministic and spoken content is plain text", () => {
  assert.equal(incidentFingerprint(incident, "2026-10-17"), incidentFingerprint(incident, "2026-10-17"));
  assert.notEqual(incidentFingerprint(incident, "2026-10-17"), incidentFingerprint(incident, "2026-10-18"));
  assert.doesNotMatch(safeVoiceAlertText(incident), /[<>&]/);
});

test("Jarvis phone endpoints verify providers, require one-time authorization, and deduplicate webhooks", async () => {
  const [phone, voice, verify, openai, status, cron, migration] = await Promise.all([
    readFile(new URL("../lib/jarvis-phone.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jarvis/twilio/voice/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jarvis/twilio/verify/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jarvis/openai/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jarvis/twilio/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/jarvis-incidents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/096_jarvis_phone.sql", import.meta.url), "utf8"),
  ]);
  assert.match(phone, /computeTwilioSignature/);
  assert.match(phone, /client\.webhooks\.unwrap\(rawBody, headers\)/);
  assert.match(phone, /accepted_at IS NULL AND expires_at > now\(\)/);
  assert.match(phone, /JARVIS_MAX_OUTBOUND_CALLS_PER_DAY/);
  assert.match(phone, /TimeLimit: String\(OUTBOUND_CALL_SECONDS_LIMIT\)/);
  assert.match(voice, /verifyTwilioSignature/);
  assert.match(verify, /authorizeJarvisPhoneCall/);
  assert.match(verify, /bucket: "jarvis-phone-pin", limit: 5/);
  assert.match(openai, /claimAuthorizedSipSession/);
  assert.match(openai, /claimVoiceWebhook/);
  assert.match(status, /verifyTwilioSignature/);
  assert.match(cron, /secureSecretMatches/);
  assert.match(migration, /PRIMARY KEY \(provider, delivery_id\)/);
  assert.match(migration, /fingerprint text NOT NULL UNIQUE/);
});

test("Jarvis outbound alerts default to opt-in off", async () => {
  const migration = await readFile(new URL("../database/migrations/096_jarvis_phone.sql", import.meta.url), "utf8");
  assert.match(migration, /outbound_alerts_enabled boolean NOT NULL DEFAULT false/);
});

test("Jarvis incident calls create only an approval-gated Codex draft", async () => {
  const [phone, action, bridge, migration] = await Promise.all([
    readFile(new URL("../lib/jarvis-phone.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jarvis/twilio/incident-action/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/jarvis-codex.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/104_jarvis_codex_tasks.sql", import.meta.url), "utf8"),
  ]);
  assert.match(phone, /input="speech dtmf"/);
  assert.match(phone, /createCodexDraftFromIncident/);
  assert.match(action, /verifyTwilioSignature/);
  assert.match(action, /speech\.includes\("codex"\)/);
  assert.match(action, /Review and approve it in the Jarvis admin dashboard/);
  assert.match(bridge, /status text NOT NULL DEFAULT 'draft'|status = 'draft'/);
  assert.match(migration, /source_incident_alert_id uuid REFERENCES jarvis_incident_alerts/);
  assert.match(migration, /jarvis_codex_tasks_open_incident_key/);
});
