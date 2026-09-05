import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

const PRIMARY_ADMIN_EMAIL = "asvokx@gmail.com";

export function isOwnerEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

function configuredAdminEmails() {
  return new Set(
    (process.env.BOOKME_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return isOwnerEmail(normalizedEmail) || configuredAdminEmails().has(normalizedEmail);
}

export async function hasAdminAccess(userId: string, email: string | null | undefined) {
  if (isAdminEmail(email)) return true;
  const result = await database.query<{ allowed: boolean }>(
    "SELECT true AS allowed FROM bookme_admins WHERE user_id = $1 LIMIT 1",
    [userId],
  );
  return Boolean(result.rows[0]?.allowed);
}

export async function getAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session && await hasAdminAccess(session.user.id, session.user.email) ? session : null;
}
