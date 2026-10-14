import "server-only";

import { database } from "@/lib/database";

export const AGE_CONFIRMATION_REQUIRED_MESSAGE = "Confirm that you are at least 18 in Account settings before using this marketplace feature.";

export async function hasConfirmedAge(userId: string) {
  const result = await database.query<{ confirmed: boolean }>(
    `SELECT age_verified_at IS NOT NULL AS confirmed FROM "user" WHERE id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.confirmed === true;
}
