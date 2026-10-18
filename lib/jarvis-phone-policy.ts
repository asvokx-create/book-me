import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { JarvisIncident } from "@/lib/jarvis-policy";

export type JarvisPhoneSettings = {
  outboundAlertsEnabled: boolean;
  minimumSeverity: "critical" | "high";
  quietHoursStart: number;
  quietHoursEnd: number;
  timeZone: string;
};

export function isE164PhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function computeTwilioSignature(authToken: string, url: string, params: URLSearchParams) {
  const keys = [...new Set(params.keys())].sort();
  let signed = url;
  for (const key of keys) for (const value of params.getAll(key)) signed += `${key}${value}`;
  return createHmac("sha1", authToken).update(signed).digest("base64");
}

export function constantTimeTextEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function incidentMeetsThreshold(severity: JarvisIncident["severity"], minimum: "critical" | "high") {
  if (severity === "medium") return false;
  return minimum === "high" || severity === "critical";
}

export function isInsideApprovedCallingHours(now: Date, settings: JarvisPhoneSettings) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: settings.timeZone,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? -1);
  if (!Number.isInteger(hour) || hour < 0) return false;
  const { quietHoursStart: start, quietHoursEnd: end } = settings;
  const quiet = start === end ? false : start < end ? hour >= start && hour < end : hour >= start || hour < end;
  return !quiet;
}

export function incidentFingerprint(incident: JarvisIncident, day = new Date().toISOString().slice(0, 10)) {
  return createHash("sha256").update(`${day}|${incident.key}|${incident.evidence}`).digest("hex");
}

export function safeVoiceAlertText(incident: JarvisIncident) {
  const title = incident.title.replace(/[^a-zA-Z0-9 ,.']/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  const evidence = incident.evidence.replace(/[^a-zA-Z0-9 ,.']/g, " ").replace(/\s+/g, " ").trim().slice(0, 260);
  return `This is Jarvis from BubsBookings. A ${incident.severity} operations alert needs your attention. ${title}. ${evidence}. Sign in to the admin dashboard for details.`;
}
