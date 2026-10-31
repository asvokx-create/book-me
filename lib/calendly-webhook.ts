import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyCalendlyWebhookSignature(input: { rawBody: string; header: string | null; signingKey: string; nowMs?: number; toleranceSeconds?: number }) {
  if (!input.signingKey || !input.header) return false;
  const parts = Object.fromEntries(input.header.split(",").map((part) => part.split("=", 2) as [string, string]));
  const timestamp = Number(parts.t);
  const supplied = parts.v1;
  const nowMs = input.nowMs ?? Date.now();
  const tolerance = input.toleranceSeconds ?? 180;
  if (!Number.isFinite(timestamp) || !supplied || Math.abs(nowMs / 1000 - timestamp) > tolerance) return false;
  const expected = createHmac("sha256", input.signingKey).update(`${parts.t}.${input.rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}
