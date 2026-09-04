import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";

const reportStatuses = new Set(["reviewing", "resolved", "dismissed"]);
const accountStatuses = new Set(["active", "suspended", "banned"]);

async function loadDashboard() {
  const [stats, reports, events, accounts, listings, reviews, audit] = await Promise.all([
    database.query<{
      users: number; active_providers: number; active_services: number; bookings_30d: number;
      open_reports: number; blocked_30d: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM "user") AS users,
        (SELECT count(*)::int FROM provider_profiles WHERE is_active = true) AS active_providers,
        (SELECT count(*)::int FROM services s JOIN provider_profiles p ON p.id = s.provider_id WHERE s.is_active = true AND p.is_active = true) AS active_services,
        (SELECT count(*)::int FROM bookings WHERE created_at >= now() - interval '30 days') AS bookings_30d,
        (SELECT count(*)::int FROM safety_reports WHERE status IN ('open', 'reviewing')) AS open_reports,
        (SELECT count(*)::int FROM moderation_events WHERE created_at >= now() - interval '30 days') AS blocked_30d`,
    ),
    database.query(
      `SELECT sr.id::text, sr.category, sr.details, sr.status, sr.created_at,
              reporter.name AS reporter_name, reporter.email AS reporter_email,
              reported.name AS reported_name, reported.email AS reported_email,
              COALESCE(s.title, 'General conversation') AS service_title
       FROM safety_reports sr
       JOIN "user" reporter ON reporter.id = sr.reporter_id
       JOIN "user" reported ON reported.id = sr.reported_user_id
       JOIN conversations c ON c.id = sr.conversation_id
       LEFT JOIN services s ON s.id = c.service_id
       ORDER BY CASE sr.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, sr.created_at DESC
       LIMIT 50`,
    ),
    database.query(
      `SELECT me.id::text, me.surface, me.category, me.severity, me.action, me.created_at,
              u.name AS user_name, u.email AS user_email
       FROM moderation_events me
       JOIN "user" u ON u.id = me.user_id
       ORDER BY me.created_at DESC
       LIMIT 50`,
    ),
    database.query(
      `SELECT u.id, u.name, u.email, u.role, u."createdAt" AS created_at,
              ar.status AS restriction_status, ar.reason AS restriction_reason,
              p.id::text AS provider_id, p.business_name, p.is_active AS provider_active
       FROM "user" u
       LEFT JOIN account_restrictions ar ON ar.user_id = u.id
         AND (ar.expires_at IS NULL OR ar.expires_at > now())
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       ORDER BY u."createdAt" DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT s.id::text, s.title, s.category, s.is_active, s.price_cents,
              s.created_at, p.business_name, p.id::text AS provider_id
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       ORDER BY s.created_at DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT r.id::text, r.rating, r.body, r.is_hidden, r.created_at,
              customer.name AS customer_name, customer.email AS customer_email,
              s.title AS service_title, p.business_name
       FROM reviews r
       JOIN "user" customer ON customer.id = r.customer_id
       JOIN services s ON s.id = r.service_id
       JOIN provider_profiles p ON p.id = r.provider_id
       ORDER BY r.created_at DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT aal.id::text, aal.action, aal.target_type, aal.target_id, aal.details,
              aal.created_at, u.name AS actor_name
       FROM admin_audit_log aal
       JOIN "user" u ON u.id = aal.actor_user_id
       ORDER BY aal.created_at DESC
       LIMIT 75`,
    ),
  ]);

  return {
    stats: stats.rows[0],
    reports: reports.rows,
    events: events.rows,
    accounts: accounts.rows,
    listings: listings.rows,
    reviews: reviews.rows,
    audit: audit.rows,
  };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json(await loadDashboard());
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = (await request.json()) as {
    action?: unknown; targetId?: unknown; status?: unknown; reason?: unknown;
  };
  const action = typeof body.action === "string" ? body.action : "";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!targetId) return NextResponse.json({ error: "Choose an item to update." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    let targetType = "";
    let auditAction = action;
    let details: Record<string, unknown> = { status, reason };

    if (action === "report_status" && reportStatuses.has(status)) {
      const result = await client.query(
        "UPDATE safety_reports SET status = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "safety_report";
    } else if (action === "account_status" && accountStatuses.has(status)) {
      if (targetId === session.user.id) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "You cannot restrict your own admin account." }, { status: 400 });
      }
      const target = await client.query<{ id: string }>('SELECT id FROM "user" WHERE id = $1', [targetId]);
      if (!target.rows[0]) throw new Error("NOT_FOUND");
      if (status === "active") {
        await client.query("DELETE FROM account_restrictions WHERE user_id = $1", [targetId]);
      } else {
        if (!reason) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Add a reason for this account restriction." }, { status: 400 });
        }
        await client.query(
          `INSERT INTO account_restrictions (user_id, status, reason, created_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason,
             created_by = EXCLUDED.created_by, expires_at = NULL, updated_at = now()`,
          [targetId, status, reason, session.user.id],
        );
        await client.query("UPDATE provider_profiles SET is_active = false WHERE user_id = $1", [targetId]);
        await client.query('DELETE FROM "session" WHERE "userId" = $1', [targetId]);
      }
      targetType = "account";
      auditAction = status === "active" ? "account_restored" : "account_" + status;
    } else if (action === "warn_account") {
      if (!reason) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Add a reason for the warning." }, { status: 400 });
      }
      const result = await client.query<{ id: string }>('SELECT id FROM "user" WHERE id = $1', [targetId]);
      if (!result.rows[0]) throw new Error("NOT_FOUND");
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
         VALUES ($1, 'account_warning', 'Important message from BookMe', $2, '/terms', $3)`,
        [targetId, reason, "admin-warning-" + randomUUID()],
      );
      targetType = "account";
      auditAction = "account_warned";
      details = { reason };
    } else if (action === "listing_status" && (status === "active" || status === "inactive")) {
      const result = await client.query(
        "UPDATE services SET is_active = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status === "active"],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "listing";
      auditAction = status === "active" ? "listing_restored" : "listing_removed";
    } else if (action === "provider_status" && (status === "active" || status === "inactive")) {
      const result = await client.query(
        "UPDATE provider_profiles SET is_active = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status === "active"],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "provider";
      auditAction = status === "active" ? "provider_restored" : "provider_paused";
    } else if (action === "review_status" && (status === "visible" || status === "hidden")) {
      const result = await client.query(
        "UPDATE reviews SET is_hidden = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status === "hidden"],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "review";
      auditAction = status === "hidden" ? "review_hidden" : "review_restored";
    } else {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That admin action is not supported." }, { status: 400 });
    }

    await client.query(
      `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [session.user.id, auditAction, targetType, targetId, JSON.stringify(details)],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "That item no longer exists." }, { status: 404 });
    }
    console.error("Admin action failed", error);
    return NextResponse.json({ error: "We could not complete that admin action." }, { status: 500 });
  } finally {
    client.release();
  }
}
