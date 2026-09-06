import "server-only";

import { database } from "@/lib/database";

export async function recordAnalytics(input: {
  eventName: string;
  userId?: string | null;
  anonymousId?: string | null;
  path?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await database.query(
      `INSERT INTO analytics_events (event_name, user_id, anonymous_id, path, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [input.eventName, input.userId ?? null, input.anonymousId ?? null, input.path ?? null,
        input.targetType ?? null, input.targetId ?? null, JSON.stringify(input.metadata ?? {})],
    );
  } catch (error) {
    console.error("Analytics recording failed", error);
  }
}

