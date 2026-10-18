import "server-only";

import { database } from "@/lib/database";
import { getStripeMode } from "@/lib/stripe";
import { complimentaryProExpiration, type ComplimentaryProDuration, paidSubscriptionProvidesPro } from "@/lib/complimentary-pro-policy";

export type ComplimentaryProStatus = {
  active: boolean;
  grantId: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  lifetime: boolean;
  reason: string | null;
};

export async function getComplimentaryProStatus(providerId: string): Promise<ComplimentaryProStatus> {
  const result = await database.query<{
    id: string; starts_at: Date; expires_at: Date | null; reason: string | null;
  }>(`SELECT id::text, starts_at, expires_at, reason
      FROM complimentary_pro_grants
      WHERE provider_id::text = $1 AND revoked_at IS NULL AND starts_at <= now()
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC LIMIT 1`, [providerId]);
  const grant = result.rows[0];
  return grant ? {
    active: true,
    grantId: grant.id,
    startsAt: grant.starts_at,
    expiresAt: grant.expires_at,
    lifetime: grant.expires_at === null,
    reason: grant.reason,
  } : { active: false, grantId: null, startsAt: null, expiresAt: null, lifetime: false, reason: null };
}

export async function getComplimentaryProHistory(providerId: string) {
  const result = await database.query<{
    id: string; grant_id: string; action: string; reason: string | null;
    previous_expires_at: Date | null; new_expires_at: Date | null; created_at: Date; actor_name: string;
  }>(`SELECT event.id::text, event.grant_id::text, event.action, event.reason,
             event.previous_expires_at, event.new_expires_at, event.created_at,
             COALESCE(actor.name, 'Administrator') AS actor_name
      FROM complimentary_pro_grant_events event
      LEFT JOIN "user" actor ON actor.id = event.actor_user_id
      WHERE event.provider_id::text = $1
      ORDER BY event.created_at DESC LIMIT 100`, [providerId]);
  return result.rows;
}

export async function grantComplimentaryPro(input: {
  providerId: string;
  administratorId: string;
  duration: ComplimentaryProDuration;
  customDays?: number;
  reason?: string;
}) {
  const reason = input.reason?.trim().slice(0, 500) || null;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const providerResult = await client.query<{
      id: string; plan: string; stripe_subscription_id: string | null;
      stripe_subscription_status: string; stripe_billing_mode: string | null;
    }>(`SELECT id::text, plan, stripe_subscription_id, stripe_subscription_status, stripe_billing_mode
        FROM provider_profiles WHERE id::text = $1 AND is_active = true FOR UPDATE`, [input.providerId]);
    const provider = providerResult.rows[0];
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    if (provider.plan === "owner" || provider.plan === "business") throw new Error("PLAN_ALREADY_INCLUDED");
    if (paidSubscriptionProvidesPro({
      subscriptionId: provider.stripe_subscription_id,
      status: provider.stripe_subscription_status,
      billingMode: provider.stripe_billing_mode,
    }, getStripeMode())) throw new Error("PAID_SUBSCRIPTION_ACTIVE");

    const currentResult = await client.query<{ id: string; starts_at: Date; expires_at: Date | null }>(
      `SELECT id::text, starts_at, expires_at FROM complimentary_pro_grants
       WHERE provider_id::text = $1 AND revoked_at IS NULL AND starts_at <= now()
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [input.providerId],
    );
    const current = currentResult.rows[0];
    const base = current?.expires_at && current.expires_at > new Date() ? current.expires_at : new Date();
    const expiresAt = complimentaryProExpiration({ duration: input.duration, startsAt: base, customDays: input.customDays });
    let grantId: string;
    let action: "granted" | "extended";
    if (current) {
      if (current.expires_at === null) throw new Error("LIFETIME_ALREADY_ACTIVE");
      const updated = await client.query<{ id: string }>(
        `UPDATE complimentary_pro_grants SET expires_at = $2, reason = COALESCE($3, reason), updated_at = now()
         WHERE id::text = $1 RETURNING id::text`, [current.id, expiresAt, reason],
      );
      grantId = updated.rows[0].id;
      action = "extended";
      await client.query(`INSERT INTO complimentary_pro_grant_events
        (grant_id, provider_id, actor_user_id, action, reason, previous_expires_at, new_expires_at)
        VALUES ($1::uuid, $2::uuid, $3, 'extended', $4, $5, $6)`,
      [grantId, input.providerId, input.administratorId, reason, current.expires_at, expiresAt]);
    } else {
      const created = await client.query<{ id: string }>(
        `INSERT INTO complimentary_pro_grants (provider_id, granted_by, expires_at, reason)
         VALUES ($1::uuid, $2, $3, $4) RETURNING id::text`,
        [input.providerId, input.administratorId, expiresAt, reason],
      );
      grantId = created.rows[0].id;
      action = "granted";
      await client.query(`INSERT INTO complimentary_pro_grant_events
        (grant_id, provider_id, actor_user_id, action, reason, new_expires_at)
        VALUES ($1::uuid, $2::uuid, $3, 'granted', $4, $5)`,
      [grantId, input.providerId, input.administratorId, reason, expiresAt]);
    }
    await client.query("UPDATE provider_profiles SET plan = 'pro', updated_at = now() WHERE id::text = $1 AND plan = 'starter'", [input.providerId]);
    await client.query(`INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
      VALUES ($1, $2, 'complimentary_pro_grant', $3, $4::jsonb)`, [input.administratorId,
      action === "granted" ? "complimentary_pro_granted" : "complimentary_pro_extended", grantId,
      JSON.stringify({ providerId: input.providerId, expiresAt: expiresAt?.toISOString() ?? null, lifetime: expiresAt === null, reason })]);
    await client.query("COMMIT");
    return { grantId, action, expiresAt };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeComplimentaryPro(input: { providerId: string; administratorId: string; reason?: string }) {
  const reason = input.reason?.trim().slice(0, 500) || null;
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const providerResult = await client.query<{
      id: string; plan: string; stripe_subscription_id: string | null;
      stripe_subscription_status: string; stripe_billing_mode: string | null;
    }>(`SELECT id::text, plan, stripe_subscription_id, stripe_subscription_status, stripe_billing_mode
        FROM provider_profiles WHERE id::text = $1 FOR UPDATE`, [input.providerId]);
    const provider = providerResult.rows[0];
    if (!provider) throw new Error("PROVIDER_NOT_FOUND");
    const grantResult = await client.query<{ id: string; expires_at: Date | null }>(
      `UPDATE complimentary_pro_grants SET revoked_at = now(), revoked_by = $2, updated_at = now()
       WHERE id = (SELECT id FROM complimentary_pro_grants WHERE provider_id::text = $1
         AND revoked_at IS NULL AND starts_at <= now() AND (expires_at IS NULL OR expires_at > now())
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE)
       RETURNING id::text, expires_at`, [input.providerId, input.administratorId],
    );
    const grant = grantResult.rows[0];
    if (!grant) throw new Error("NO_ACTIVE_GRANT");
    const paidPro = paidSubscriptionProvidesPro({
      subscriptionId: provider.stripe_subscription_id,
      status: provider.stripe_subscription_status,
      billingMode: provider.stripe_billing_mode,
    }, getStripeMode());
    if (provider.plan !== "owner" && provider.plan !== "business") {
      await client.query("UPDATE provider_profiles SET plan = $2, updated_at = now() WHERE id::text = $1", [input.providerId, paidPro ? "pro" : "starter"]);
    }
    if (!paidPro) {
      await client.query("UPDATE provider_team_members SET status = 'inactive' WHERE provider_id::text = $1 AND status IN ('pending', 'active')", [input.providerId]);
    }
    await client.query(`INSERT INTO complimentary_pro_grant_events
      (grant_id, provider_id, actor_user_id, action, reason, previous_expires_at)
      VALUES ($1::uuid, $2::uuid, $3, 'revoked', $4, $5)`,
    [grant.id, input.providerId, input.administratorId, reason, grant.expires_at]);
    await client.query(`INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
      VALUES ($1, 'complimentary_pro_revoked', 'complimentary_pro_grant', $2, $3::jsonb)`,
    [input.administratorId, grant.id, JSON.stringify({ providerId: input.providerId, reason })]);
    await client.query("COMMIT");
    return { grantId: grant.id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reconcileExpiredComplimentaryProGrants(providerId?: string) {
  const mode = getStripeMode();
  await database.query(`INSERT INTO complimentary_pro_grant_events
    (grant_id, provider_id, actor_user_id, action, previous_expires_at)
    SELECT complimentary.id, complimentary.provider_id, NULL, 'expired', complimentary.expires_at
    FROM complimentary_pro_grants complimentary
    WHERE complimentary.revoked_at IS NULL AND complimentary.expires_at IS NOT NULL AND complimentary.expires_at <= now()
      AND ($1::uuid IS NULL OR complimentary.provider_id = $1::uuid)
      AND NOT EXISTS (SELECT 1 FROM complimentary_pro_grant_events event
        WHERE event.grant_id = complimentary.id AND event.action = 'expired')
    ON CONFLICT DO NOTHING`, [providerId ?? null]);
  const expired = await database.query<{ provider_id: string }>(
    `WITH expired AS (
       SELECT DISTINCT complimentary.provider_id
       FROM complimentary_pro_grants complimentary
       WHERE complimentary.revoked_at IS NULL AND complimentary.expires_at IS NOT NULL AND complimentary.expires_at <= now()
         AND ($1::uuid IS NULL OR complimentary.provider_id = $1::uuid)
         AND NOT EXISTS (
           SELECT 1 FROM complimentary_pro_grants active
           WHERE active.provider_id = complimentary.provider_id AND active.revoked_at IS NULL
             AND active.starts_at <= now() AND (active.expires_at IS NULL OR active.expires_at > now())
         )
     )
     UPDATE provider_profiles provider SET plan = CASE
       WHEN provider.stripe_subscription_id IS NOT NULL AND provider.stripe_billing_mode = $2
         AND provider.stripe_subscription_status IN ('active', 'trialing', 'past_due') THEN 'pro'
       ELSE 'starter' END,
       updated_at = now()
     FROM expired WHERE provider.id = expired.provider_id AND provider.plan = 'pro'
     RETURNING provider.id::text AS provider_id`, [providerId ?? null, mode],
  );
  if (expired.rows.length) {
    await database.query(`UPDATE provider_team_members member SET status = 'inactive'
      WHERE member.provider_id::text = ANY($1::text[]) AND member.status IN ('pending', 'active')
        AND NOT EXISTS (SELECT 1 FROM provider_profiles provider WHERE provider.id = member.provider_id
          AND provider.stripe_subscription_id IS NOT NULL AND provider.stripe_billing_mode = $2
          AND provider.stripe_subscription_status IN ('active', 'trialing', 'past_due'))`,
    [expired.rows.map((row) => row.provider_id), mode]);
  }
  return { complimentaryProExpired: expired.rows.length };
}
