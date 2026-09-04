import "server-only";

import { createHash } from "node:crypto";
import { database } from "@/lib/database";

export async function enforceRateLimit(input: { request: Request; userId: string; bucket: string; limit?: number; windowSeconds?: number }) {
  const limit = input.limit ?? 20;
  const windowSeconds = input.windowSeconds ?? 60;
  const forwarded = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const identifier = createHash("sha256").update(`${input.userId}:${forwarded}`).digest("hex");
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
