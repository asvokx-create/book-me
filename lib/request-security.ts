import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { database } from "@/lib/database";

export async function enforceRateLimit(input: { request: Request; userId: string; bucket: string; limit?: number; windowSeconds?: number }) {
  const limit = input.limit ?? 20;
  const windowSeconds = input.windowSeconds ?? 60;
  // Authenticated limits must follow the account, not a caller-controlled forwarding header.
  // Otherwise changing X-Forwarded-For could create a fresh bucket for every request.
  const identifier = createHash("sha256").update(input.userId).digest("hex");
  const result = await database.query<{ request_count: number }>(
    `INSERT INTO request_rate_limits (bucket, identifier_hash, window_started_at, request_count)
     VALUES ($1, $2, to_timestamp(floor(extract(epoch FROM now()) / $3) * $3), 1)
     ON CONFLICT (bucket, identifier_hash, window_started_at)
     DO UPDATE SET request_count = request_rate_limits.request_count + 1
     RETURNING request_count`,
    [input.bucket, identifier, windowSeconds],
  );
  return (result.rows[0]?.request_count ?? 1) <= limit;
}

/**
 * Returns a stable, privacy-preserving key for public routes that do not have
 * an authenticated account yet. The key is hashed by enforceRateLimit before
 * it is stored. On DigitalOcean App Platform, do-connecting-ip is supplied by
 * the trusted platform proxy. Do not trust a user-supplied forwarding header
 * in production as a fallback, because callers can forge it.
 */
export function publicRequestRateLimitKey(request: Request) {
  const platformIp = request.headers.get("do-connecting-ip")?.trim();
  if (platformIp) return `ip:${platformIp.slice(0, 128)}`;

  // This is only a local-development convenience. Production requests without
  // the platform header deliberately share a small fail-closed bucket.
  if (process.env.NODE_ENV !== "production") {
    const developmentIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (developmentIp) return `ip:${developmentIp.slice(0, 128)}`;
  }
  return "ip:unavailable";
}

export async function recordActivity(input: { userId: string; action: string; targetType: string; targetId?: string; metadata?: Record<string, unknown> }) {
  try {
    await database.query(
      `INSERT INTO activity_log (user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [input.userId, input.action, input.targetType, input.targetId ?? null, JSON.stringify(input.metadata ?? {})],
    );
  } catch (error) {
    console.error("Activity logging failed", error);
  }
}

export function secureSecretMatches(configured: string | undefined, supplied: string | undefined) {
  if (!configured || !supplied) return false;
  const configuredDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}
