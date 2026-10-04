import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { releaseBookingPayout } from "@/lib/payment-release";
import { scanContent } from "@/lib/content-safety";
import { assessListingFinancialCrimeRisk } from "@/lib/financial-crime-screening";
import { enforceRateLimit } from "@/lib/request-security";

const reportStatuses = new Set(["reviewing", "resolved", "dismissed"]);
const accountStatuses = new Set(["active", "under_review", "suspended", "banned"]);
const messageModerationStatuses = new Set(["confirmed", "false_positive", "warning_only", "under_review", "suspended", "banned", "resolved"]);

async function loadDashboard() {
  const [stats, reports, events, messageModeration, accounts, listings, reviews, payouts, audit] = await Promise.all([
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
        ((SELECT count(*)::int FROM moderation_events WHERE created_at >= now() - interval '30 days') +
         (SELECT count(*)::int FROM message_moderation_events WHERE action_taken <> 'logged' AND created_at >= now() - interval '30 days')) AS blocked_30d`,
    ),
    database.query(
      `SELECT sr.id::text, sr.category, sr.details, sr.status, sr.created_at,
              reporter.name AS reporter_name, reporter.email AS reporter_email,
              reported.name AS reported_name, reported.email AS reported_email,
              COALESCE(conversation_service.title, booking_service.title, 'General report') AS service_title
       FROM safety_reports sr
       JOIN "user" reporter ON reporter.id = sr.reporter_id
       JOIN "user" reported ON reported.id = sr.reported_user_id
       LEFT JOIN conversations c ON c.id = sr.conversation_id
       LEFT JOIN services conversation_service ON conversation_service.id = c.service_id
       LEFT JOIN bookings b ON b.id = sr.booking_id
       LEFT JOIN services booking_service ON booking_service.id = b.service_id
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
      `SELECT event.id::text, event.message_id::text, event.conversation_id::text, event.booking_id::text,
              event.sender_id, event.recipient_id, event.sender_name, event.sender_email,
              event.message_content, event.risk_level, event.detection_reason, event.triggered_rules,
              event.detected_signals, event.booking_context, event.action_taken, event.status,
              event.account_status_snapshot, event.admin_notes, event.created_at, event.reviewed_at,
              COALESCE(recipient.name, 'Deleted account') AS recipient_name,
              COALESCE(restriction.status, 'active') AS current_account_status,
              COALESCE(service.title, 'General conversation') AS service_title,
              COALESCE((SELECT count(*)::int FROM message_moderation_events prior
                        WHERE prior.sender_id = event.sender_id AND prior.created_at < event.created_at), 0) AS previous_violations
       FROM message_moderation_events event
       LEFT JOIN "user" recipient ON recipient.id = event.recipient_id
       LEFT JOIN account_restrictions restriction ON restriction.user_id = event.sender_id
         AND (restriction.expires_at IS NULL OR restriction.expires_at > now())
       LEFT JOIN conversations conversation ON conversation.id = event.conversation_id
       LEFT JOIN services service ON service.id = conversation.service_id
       ORDER BY CASE event.status WHEN 'under_review' THEN 0 WHEN 'open' THEN 1 WHEN 'suspended' THEN 2 WHEN 'banned' THEN 3 ELSE 4 END,
                CASE event.risk_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                event.created_at DESC
       LIMIT 150`,
    ),
    database.query(
      `SELECT u.id, u.name, u.email, u.image, u.role, u."createdAt" AS created_at,
              ar.status AS restriction_status, ar.reason AS restriction_reason,
              p.id::text AS provider_id, p.business_name, p.plan AS provider_plan, p.is_active AS provider_active,
              p.phone_verified, p.identity_verified, p.business_verified
       FROM "user" u
       LEFT JOIN account_restrictions ar ON ar.user_id = u.id
         AND (ar.expires_at IS NULL OR ar.expires_at > now())
       LEFT JOIN provider_profiles p ON p.user_id = u.id
       ORDER BY u."createdAt" DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT s.id::text, s.slug, s.title, s.category, s.description, s.delivery_type, s.is_active, s.price_cents,
              s.created_at, s.business_name, p.city, p.state, p.id::text AS provider_id
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       ORDER BY s.created_at DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT r.id::text, r.rating, r.body, r.is_hidden, r.created_at,
              customer.name AS customer_name, customer.email AS customer_email,
              s.title AS service_title, s.business_name
       FROM reviews r
       JOIN "user" customer ON customer.id = r.customer_id
       JOIN services s ON s.id = r.service_id
       JOIN provider_profiles p ON p.id = r.provider_id
       ORDER BY r.created_at DESC
       LIMIT 75`,
    ),
    database.query(
      `SELECT b.id::text, b.payment_release_status, b.payment_status, b.price_cents,
              b.customer_service_fee_cents, b.customer_total_cents, b.platform_fee_cents,
              b.provider_payout_cents, b.provider_plan_snapshot, b.provider_fee_basis_points,
              b.stripe_payment_intent_id, b.stripe_charge_id, b.stripe_transfer_id,
              b.refunded_amount_cents, b.stripe_refund_id, b.completed_at, b.customer_confirmed_at,
              b.completion_confirmation_due_at, b.payout_released_at, b.payout_freeze_reason,
              b.payout_failure_reason, b.status AS booking_status, b.created_at,
              customer.name AS customer_name, s.business_name AS provider_name, s.title AS service_title
       FROM bookings b
       JOIN "user" customer ON customer.id = b.customer_id
       JOIN provider_profiles p ON p.id = b.provider_id
       JOIN services s ON s.id = b.service_id
       WHERE b.payment_status = 'paid' AND b.payment_release_status <> 'not_applicable'
       ORDER BY CASE b.payment_release_status
         WHEN 'failed' THEN 0 WHEN 'frozen' THEN 1 WHEN 'awaiting_customer' THEN 2
         WHEN 'secured' THEN 3 ELSE 4 END, b.created_at DESC
       LIMIT 100`,
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
    messageModeration: messageModeration.rows,
    accounts: accounts.rows,
    listings: listings.rows,
    reviews: reviews.rows,
    payouts: payouts.rows,
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
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-action", limit: 30 })) return NextResponse.json({ error: "Too many admin actions. Please wait a minute." }, { status: 429 });

  const body = (await request.json()) as {
    action?: unknown; targetId?: unknown; status?: unknown; reason?: unknown;
  };
  const action = typeof body.action === "string" ? body.action : "";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const status = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!targetId) return NextResponse.json({ error: "Choose an item to update." }, { status: 400 });

  if (action === "payout_retry") {
    const release = await releaseBookingPayout(targetId, "admin");
    if (!release.ok) return NextResponse.json({ error: release.error }, { status: 409 });
    await database.query(`INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
      VALUES ($1, 'payout_retried', 'booking_payout', $2, $3::jsonb)`, [session.user.id, targetId, JSON.stringify({ transferId: release.transferId })]);
    return NextResponse.json({ ok: true });
  }

  if (action === "listing_safety_scan") {
    const listingResult = await database.query<{
      id: string; title: string; category: string; description: string; price_cents: number;
      business_name: string; city: string; state: string; owner_id: string;
    }>(
      `SELECT s.id::text, s.title, s.category, s.description, s.price_cents,
              s.business_name, p.city, p.state, p.user_id AS owner_id
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1
       LIMIT 1`,
      [targetId],
    );
    const listing = listingResult.rows[0];
    if (!listing) return NextResponse.json({ error: "That listing no longer exists." }, { status: 404 });

    const content = [listing.title, listing.category, listing.description, listing.business_name, listing.city, listing.state].join("\n");
    const safety = scanContent(content);
    const financialRisk = assessListingFinancialCrimeRisk({
      businessName: listing.business_name,
      title: listing.title,
      category: listing.category,
      description: listing.description,
      priceCents: listing.price_cents,
    });
    const client = await database.connect();
    try {
      await client.query("BEGIN");
      if (!safety.allowed) {
        await client.query(
          `INSERT INTO moderation_events (user_id, surface, category, severity, action, content_hash)
           VALUES ($1, 'admin_listing_review', $2, $3, 'flagged', $4)`,
          [listing.owner_id, safety.category, safety.severity, createHash("sha256").update(content).digest("hex")],
        );
      }
      if (financialRisk.reviewRequired) {
        await client.query(
          `INSERT INTO moderation_events (user_id, surface, category, severity, action, content_hash)
           VALUES ($1, 'admin_listing_financial_review', $2, $3, 'flagged', $4)`,
          [listing.owner_id, financialRisk.category, financialRisk.level === "high" ? "high" : "medium", createHash("sha256").update(`${content}\n${listing.price_cents}`).digest("hex")],
        );
      }
      await client.query(
        `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
         VALUES ($1, 'listing_safety_scanned', 'listing', $2, $3::jsonb)`,
        [session.user.id, targetId, JSON.stringify({ allowed: safety.allowed && financialRisk.allowed, category: safety.category, severity: safety.severity, financialRisk: { level: financialRisk.level, score: financialRisk.score, reasons: financialRisk.reasons } })],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Listing safety scan failed", error);
      return NextResponse.json({ error: "The Safety Bot could not review this listing." }, { status: 500 });
    } finally {
      client.release();
    }

    return NextResponse.json({
      ok: true,
      safety,
      financialRisk,
      message: !safety.allowed
        ? `Safety Bot flagged “${listing.title}” for ${safety.category} (${safety.severity}). Review the listing before taking action.`
        : financialRisk.reviewRequired
          ? `Safety Bot flagged “${listing.title}” for financial-safety review (${financialRisk.level} risk, score ${financialRisk.score}). Review the listing and provider before taking action.`
          : `Safety Bot passed “${listing.title}”. No blocked content or suspicious payment patterns were found.`,
    });
  }

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
    } else if (action === "message_moderation_status" && messageModerationStatuses.has(status)) {
      const eventResult = await client.query<{ sender_id: string | null; risk_level: string }>(
        `SELECT sender_id, risk_level FROM message_moderation_events WHERE id::text = $1 FOR UPDATE`,
        [targetId],
      );
      const event = eventResult.rows[0];
      if (!event) throw new Error("NOT_FOUND");
      await client.query(
        `UPDATE message_moderation_events SET status = $2, admin_notes = $3,
           reviewed_by = $4, reviewed_at = now(), updated_at = now() WHERE id::text = $1`,
        [targetId, status, reason, session.user.id],
      );
      if (event.sender_id && ["under_review", "suspended", "banned"].includes(status)) {
        if (event.sender_id === session.user.id) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "You cannot restrict your own admin account." }, { status: 400 });
        }
        const publicReason = reason || (status === "under_review"
          ? "Possible violation of the BubsBookings marketplace rules"
          : "Violation of the BubsBookings marketplace rules");
        await client.query(
          `INSERT INTO account_restrictions (user_id, status, reason, created_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, reason = EXCLUDED.reason,
             created_by = EXCLUDED.created_by, expires_at = NULL, updated_at = now()`,
          [event.sender_id, status, publicReason, session.user.id],
        );
        if (status === "suspended" || status === "banned") {
          await client.query("UPDATE provider_profiles SET is_active = false WHERE user_id = $1", [event.sender_id]);
          await client.query('DELETE FROM "session" WHERE "userId" = $1', [event.sender_id]);
        }
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
           VALUES ($1, 'account_moderation', $2, $3, '/support', $4)
           ON CONFLICT (dedupe_key) DO NOTHING`,
          [event.sender_id,
            status === "under_review" ? "Your account is under review" : status === "suspended" ? "Your account is suspended" : "Your account is banned",
            status === "under_review" ? "Your account is under review for a possible marketplace-rules violation. Some features may be limited while the review is completed." : `Your account has been ${status}. ${publicReason}`,
            `message-moderation-${targetId}-${status}`],
        );
      } else if (event.sender_id && (status === "false_positive" || status === "resolved" || status === "warning_only")) {
        const remaining = await client.query(
          `SELECT 1 FROM message_moderation_events
           WHERE sender_id = $1 AND id::text <> $2 AND status = 'under_review' LIMIT 1`,
          [event.sender_id, targetId],
        );
        if (!remaining.rowCount) {
          const cleared = await client.query(
            `DELETE FROM account_restrictions WHERE user_id = $1 AND status = 'under_review' RETURNING user_id`,
            [event.sender_id],
          );
          if (cleared.rowCount) await client.query(
            `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
             VALUES ($1, 'account_review_cleared', 'Account review completed',
               'Your BubsBookings account review is complete and the temporary messaging limit has been removed.',
               '/account', $2) ON CONFLICT (dedupe_key) DO NOTHING`,
            [event.sender_id, `message-moderation-${targetId}-cleared`],
          );
        }
        if (status === "warning_only") await client.query(
          `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
           VALUES ($1, 'account_warning', 'Marketplace messaging reminder',
             'Keep bookings and payments that originate on BubsBookings on the platform. Review the marketplace rules before sending another message.',
             '/terms', $2) ON CONFLICT (dedupe_key) DO NOTHING`,
          [event.sender_id, `message-moderation-${targetId}-warning`],
        );
      }
      targetType = "message_moderation_event";
      auditAction = `message_moderation_${status}`;
      details = { status, notes: reason, riskLevel: event.risk_level, senderId: event.sender_id };
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
        if (status === "suspended" || status === "banned") {
          await client.query("UPDATE provider_profiles SET is_active = false WHERE user_id = $1", [targetId]);
          await client.query('DELETE FROM "session" WHERE "userId" = $1', [targetId]);
        }
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
         VALUES ($1, 'account_warning', 'Important message from BubsBookings', $2, '/terms', $3)`,
        [targetId, reason, "admin-warning-" + randomUUID()],
      );
      targetType = "account";
      auditAction = "account_warned";
      details = { reason };
    } else if (action === "listing_status" && (status === "active" || status === "inactive")) {
      const result = await client.query<{ id: string; is_active: boolean; provider_id: string; company_id: string }>(
        "UPDATE services SET is_active = $2, updated_at = now() WHERE id = $1::uuid RETURNING id::text, is_active, provider_id::text, company_id::text",
        [targetId, status === "active"],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      const listing = result.rows[0];
      if (status === "inactive") {
        await client.query(
          `UPDATE provider_team_members member
           SET status = 'inactive', updated_at = now()
           WHERE member.provider_id::text = $1 AND member.company_id::text = $2 AND member.status = 'active'
             AND NOT EXISTS (
               SELECT 1 FROM services remaining
               WHERE remaining.provider_id = member.provider_id
                 AND remaining.company_id = member.company_id
                 AND remaining.is_active = true
             )`,
          [listing.provider_id, listing.company_id],
        );
      }
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
    } else if (action === "provider_verification" && ["phone", "identity", "business"].includes(status)) {
      const column = status === "phone" ? "phone_verified" : status === "identity" ? "identity_verified" : "business_verified";
      const result = await client.query(`UPDATE provider_profiles SET ${column} = NOT ${column}, is_verified = CASE WHEN $2 = 'identity' OR $2 = 'business' THEN true ELSE is_verified END, updated_at = now() WHERE id::text = $1`, [targetId, status]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "provider";
      auditAction = `provider_${status}_verification_toggled`;
    } else if (action === "review_status" && (status === "visible" || status === "hidden")) {
      const result = await client.query(
        "UPDATE reviews SET is_hidden = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status === "hidden"],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "review";
      auditAction = status === "hidden" ? "review_hidden" : "review_restored";
    } else if (action === "portfolio_status" && (status === "active" || status === "hidden")) {
      const result = await client.query(
        "UPDATE provider_portfolio_items SET moderation_status = $2, updated_at = now() WHERE id::text = $1",
        [targetId, status],
      );
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "provider_portfolio";
      auditAction = status === "hidden" ? "provider_portfolio_hidden" : "provider_portfolio_restored";
    } else if (action === "payout_freeze" && (status === "frozen" || status === "active")) {
      if (status === "frozen" && !reason) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Add a reason for freezing this payout." }, { status: 400 });
      }
      const result = status === "frozen"
        ? await client.query(`UPDATE bookings SET payout_frozen_at = now(), payout_frozen_by = $2,
            payout_freeze_reason = $3, payment_release_status = 'frozen'
            WHERE id::text = $1 AND payment_status = 'paid'
              AND payment_release_status IN ('secured', 'awaiting_customer', 'failed') RETURNING id`, [targetId, session.user.id, reason])
        : await client.query(`UPDATE bookings SET payout_frozen_at = NULL, payout_frozen_by = NULL,
            payout_freeze_reason = NULL,
            payment_release_status = CASE WHEN status = 'completed' THEN 'awaiting_customer' ELSE 'secured' END
            WHERE id::text = $1 AND payment_release_status = 'frozen'
              AND refund_status NOT IN ('requested', 'processing')
              AND NOT EXISTS (SELECT 1 FROM booking_disputes d WHERE d.booking_id = bookings.id AND d.status IN ('open', 'reviewing'))
            RETURNING id`, [targetId]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      targetType = "booking_payout";
      auditAction = status === "frozen" ? "payout_frozen" : "payout_unfrozen";
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
    return NextResponse.json({ ok: true, action: auditAction, targetId });
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
