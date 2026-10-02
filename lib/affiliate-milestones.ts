import "server-only";

import type { PoolClient } from "pg";
import { database } from "./database";
import { sendTransactionalEmail } from "./email";
import { milestoneConfig } from "./affiliate-milestone-config";

type DbClient = Pick<PoolClient, "query">;

type ProgressRow = {
  affiliate_id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  affiliate_status: string;
  enabled: boolean;
  backfill_approved: boolean;
  hold_period_days: number;
  thresholds: number[];
  bonuses: number[];
  active_provider_count: number;
};

export type AffiliateMilestoneProgress = {
  affiliateId: string;
  userId: string | null;
  displayName: string;
  email: string;
  affiliateStatus: string;
  enabled: boolean;
  backfillApproved: boolean;
  holdPeriodDays: number;
  activeProviderCount: number;
  milestones: Array<{ threshold: number; bonusCents: number }>;
  achievements: Array<{ id: string; threshold: number; bonusCents: number; status: string; earnedAt: Date; paidAt: Date | null; reversedAt: Date | null }>;
};

const activeProviderCte = `WITH qualifying_bookings AS (
    SELECT referral.id AS referral_id, referral.affiliate_id, referral.provider_id,
      count(DISTINCT booking.id)::int AS qualified_booking_count,
      referral.active_provider_required_bookings
    FROM affiliate_referrals referral
    JOIN provider_profiles provider ON provider.id = referral.provider_id AND provider.is_active = true
    JOIN bookings booking ON booking.provider_id = referral.provider_id
    WHERE referral.affiliate_id::text = $1 AND referral.status <> 'disqualified'
      AND booking.status = 'completed' AND booking.payment_status = 'paid'
      AND booking.payment_release_status IN ('paid_out','partially_released')
      AND booking.payout_released_at IS NOT NULL
      AND booking.payout_released_at + make_interval(days => referral.hold_period_days) <= now()
      AND booking.refunded_amount_cents < booking.price_cents
      AND (booking.stripe_dispute_status IS NULL OR booking.stripe_dispute_status IN ('won','warning_closed'))
      AND NOT EXISTS (SELECT 1 FROM booking_disputes dispute WHERE dispute.booking_id = booking.id AND dispute.status IN ('open','reviewing'))
      AND NOT EXISTS (SELECT 1 FROM account_restrictions restriction WHERE restriction.user_id = provider.user_id
        AND restriction.status IN ('suspended','banned') AND (restriction.expires_at IS NULL OR restriction.expires_at > now()))
    GROUP BY referral.id
  ), active_providers AS (
    SELECT referral_id, affiliate_id, provider_id, qualified_booking_count
    FROM qualifying_bookings WHERE qualified_booking_count >= active_provider_required_bookings
  )`;

export async function getAffiliateMilestoneProgress(affiliateId: string, client: DbClient = database): Promise<AffiliateMilestoneProgress | null> {
  const result = await client.query<ProgressRow>(`${activeProviderCte}
    SELECT affiliate.id::text AS affiliate_id, affiliate.user_id, affiliate.display_name, affiliate.email,
      affiliate.status AS affiliate_status,
      COALESCE(affiliate.milestone_bonuses_override, program.milestone_bonuses_enabled) AS enabled,
      affiliate.milestone_backfill_approved AS backfill_approved,
      program.hold_period_days, program.milestone_thresholds AS thresholds,
      program.milestone_bonus_cents AS bonuses,
      (SELECT count(*)::int FROM active_providers) AS active_provider_count
    FROM affiliate_profiles affiliate
    JOIN affiliate_programs program ON program.id = affiliate.program_id
    WHERE affiliate.id::text = $1`, [affiliateId]);
  const row = result.rows[0];
  if (!row) return null;
  const achievements = await client.query<{
    id: string; milestone_threshold: number; bonus_amount_cents: number; status: string;
    earned_at: Date; paid_at: Date | null; reversed_at: Date | null;
  }>(`SELECT achievement.id::text, achievement.milestone_threshold, achievement.bonus_amount_cents,
      commission.status, achievement.earned_at, commission.paid_at, achievement.reversed_at
    FROM affiliate_milestone_achievements achievement
    JOIN affiliate_commissions commission ON commission.id = achievement.commission_id
    WHERE achievement.affiliate_id::text=$1 ORDER BY achievement.milestone_threshold`, [affiliateId]);
  return {
    affiliateId: row.affiliate_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    affiliateStatus: row.affiliate_status,
    enabled: row.enabled,
    backfillApproved: row.backfill_approved,
    holdPeriodDays: row.hold_period_days,
    activeProviderCount: row.active_provider_count,
    milestones: milestoneConfig(row.thresholds, row.bonuses),
    achievements: achievements.rows.map((item) => ({
      id: item.id,
      threshold: item.milestone_threshold,
      bonusCents: item.bonus_amount_cents,
      status: item.status,
      earnedAt: item.earned_at,
      paidAt: item.paid_at,
      reversedAt: item.reversed_at,
    })),
  };
}

export async function evaluateAffiliateMilestonesForAffiliate(affiliateId: string, client: DbClient = database) {
  if (client === (database as unknown as DbClient)) {
    const transaction = await database.connect();
    try {
      await transaction.query("BEGIN");
      const result = await evaluateAffiliateMilestonesInTransaction(affiliateId, transaction);
      await transaction.query("COMMIT");
      return result;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw error;
    } finally {
      transaction.release();
    }
  }
  return evaluateAffiliateMilestonesInTransaction(affiliateId, client);
}

async function evaluateAffiliateMilestonesInTransaction(affiliateId: string, client: DbClient) {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`affiliate-milestones:${affiliateId}`]);
  const progress = await getAffiliateMilestoneProgress(affiliateId, client);
  if (!progress) return { created: 0, reversed: 0, activeProviderCount: 0 };
  if (!progress.enabled) return { created: 0, reversed: 0, activeProviderCount: progress.activeProviderCount };

  let reversed = 0;
  for (const achievement of progress.achievements.filter((item) => !item.reversedAt && item.threshold > progress.activeProviderCount)) {
    const commission = await client.query<{ id: string; status: string; referral_id: string; provider_id: string; amount_cents: number }>(
      `SELECT id::text,status,referral_id::text,provider_id::text,amount_cents FROM affiliate_commissions WHERE id=(SELECT commission_id FROM affiliate_milestone_achievements WHERE id=$1::uuid) FOR UPDATE`,
      [achievement.id],
    );
    const row = commission.rows[0];
    if (!row) continue;
    const reason = `Active Provider count decreased below the ${achievement.threshold} milestone after booking eligibility changed.`;
    if (row.status === "paid") {
      await client.query(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,provider_id,payment_reference,commission_type,amount_cents,status,eligible_at,payable_at,reversal_reason,admin_notes)
        VALUES ($1,$2,$3,$4,'reversal',$5,'payable',now(),now(),$6,$6)
        ON CONFLICT DO NOTHING`, [affiliateId,row.referral_id,row.provider_id,`milestone-reversal:${achievement.id}`,-Math.abs(row.amount_cents),reason]);
    } else {
      await client.query(`UPDATE affiliate_commissions SET status='reversed',reversal_reason=$2 WHERE id=$1::uuid`, [row.id,reason]);
    }
    await client.query(`UPDATE affiliate_milestone_achievements SET reversed_at=COALESCE(reversed_at,now()),reversal_reason=$2 WHERE id=$1::uuid`, [achievement.id,reason]);
    await client.query(`INSERT INTO affiliate_audit_log (action,target_type,target_id,details) VALUES ('milestone_reversed','affiliate_milestone',$1,$2::jsonb)`, [achievement.id,JSON.stringify({ affiliateId, threshold:achievement.threshold, activeProviderCount:progress.activeProviderCount, reason })]);
    reversed += 1;
  }

  if (!progress.backfillApproved || progress.affiliateStatus !== "active") {
    return { created: 0, reversed, activeProviderCount: progress.activeProviderCount };
  }
  const trigger = await client.query<{ referral_id: string; provider_id: string }>(`${activeProviderCte}
    SELECT referral_id::text,provider_id::text FROM active_providers ORDER BY qualified_booking_count DESC, referral_id LIMIT 1`, [affiliateId]);
  const triggerRow = trigger.rows[0];
  if (!triggerRow) return { created: 0, reversed, activeProviderCount: progress.activeProviderCount };

  let created = 0;
  for (const milestone of progress.milestones.filter((item) => item.threshold <= progress.activeProviderCount)) {
    const achievement = await client.query<{ id: string }>(`INSERT INTO affiliate_milestone_achievements
        (affiliate_id,triggering_referral_id,triggering_provider_id,milestone_threshold,bonus_amount_cents,active_provider_count)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (affiliate_id,milestone_threshold) DO NOTHING RETURNING id::text`,
    [affiliateId,triggerRow.referral_id,triggerRow.provider_id,milestone.threshold,milestone.bonusCents,progress.activeProviderCount]);
    const achievementId = achievement.rows[0]?.id;
    if (!achievementId) continue;
    const payableAt = new Date(Date.now() + progress.holdPeriodDays * 86_400_000);
    const commission = await client.query<{ id: string }>(`INSERT INTO affiliate_commissions
        (affiliate_id,referral_id,provider_id,payment_reference,commission_type,amount_cents,status,eligible_at,payable_at,admin_notes)
      VALUES ($1,$2,$3,$4,'milestone_bonus',$5,'hold',now(),$6,$7) RETURNING id::text`,
    [affiliateId,triggerRow.referral_id,triggerRow.provider_id,`milestone:${affiliateId}:${milestone.threshold}`,milestone.bonusCents,payableAt,`${milestone.threshold} Active Provider Growth Bonus`]);
    let notificationId: string | null = null;
    if (progress.userId) {
      const notification = await client.query<{ id: string }>(`INSERT INTO notifications (user_id,type,title,message,href,dedupe_key)
        VALUES ($1,'partner_milestone','Provider Growth milestone reached',$2,'/affiliate#provider-growth-milestones',$3)
        ON CONFLICT (dedupe_key) DO UPDATE SET dedupe_key=EXCLUDED.dedupe_key RETURNING id::text`,
      [progress.userId,`You earned a ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(milestone.bonusCents/100)} bonus for reaching ${milestone.threshold} Active Providers.`,`partner-milestone:${affiliateId}:${milestone.threshold}`]);
      notificationId = notification.rows[0]?.id ?? null;
    }
    await client.query(`UPDATE affiliate_milestone_achievements SET commission_id=$2,notification_id=$3::uuid WHERE id=$1::uuid`, [achievementId,commission.rows[0].id,notificationId]);
    await client.query(`INSERT INTO affiliate_audit_log (action,target_type,target_id,details) VALUES ('milestone_bonus_created','affiliate_milestone',$1,$2::jsonb)`, [achievementId,JSON.stringify({ affiliateId, threshold:milestone.threshold, bonusCents:milestone.bonusCents, activeProviderCount:progress.activeProviderCount })]);
    created += 1;
  }
  return { created, reversed, activeProviderCount: progress.activeProviderCount };
}

export async function evaluateAffiliateMilestonesForProvider(providerId: string, client: DbClient = database) {
  const referral = await client.query<{ affiliate_id: string }>(`SELECT affiliate_id::text FROM affiliate_referrals WHERE provider_id::text=$1 LIMIT 1`, [providerId]);
  return referral.rows[0]
    ? evaluateAffiliateMilestonesForAffiliate(referral.rows[0].affiliate_id, client)
    : { created: 0, reversed: 0, activeProviderCount: 0 };
}

export async function reconcileAffiliateMilestones(limit = 100) {
  const affiliates = await database.query<{ id: string }>(`SELECT affiliate.id::text FROM affiliate_profiles affiliate
    JOIN affiliate_programs program ON program.id=affiliate.program_id
    WHERE COALESCE(affiliate.milestone_bonuses_override,program.milestone_bonuses_enabled)=true
      AND affiliate.status IN ('active','paused') ORDER BY affiliate.updated_at LIMIT $1`, [limit]);
  let created = 0;
  let reversed = 0;
  for (const affiliate of affiliates.rows) {
    const result = await evaluateAffiliateMilestonesForAffiliate(affiliate.id);
    created += result.created;
    reversed += result.reversed;
  }
  return { checked: affiliates.rowCount ?? 0, created, reversed };
}

export async function processAffiliateMilestoneEmails(limit = 25) {
  const queued = await database.query<{
    id: string; affiliate_id: string; display_name: string; email: string; user_id: string | null;
    milestone_threshold: number; bonus_amount_cents: number; thresholds: number[]; bonuses: number[];
  }>(`SELECT achievement.id::text,achievement.affiliate_id::text,affiliate.display_name,affiliate.email,affiliate.user_id,
      achievement.milestone_threshold,achievement.bonus_amount_cents,program.milestone_thresholds AS thresholds,
      program.milestone_bonus_cents AS bonuses
    FROM affiliate_milestone_achievements achievement
    JOIN affiliate_profiles affiliate ON affiliate.id=achievement.affiliate_id
    JOIN affiliate_programs program ON program.id=affiliate.program_id
    WHERE achievement.email_sent_at IS NULL AND achievement.reversed_at IS NULL AND achievement.email_attempt_count < 5
      AND COALESCE(affiliate.milestone_bonuses_override,program.milestone_bonuses_enabled,false)=true
    ORDER BY achievement.created_at LIMIT $1`, [limit]);
  let sent = 0;
  for (const item of queued.rows) {
    const milestones = milestoneConfig(item.thresholds,item.bonuses);
    const next = milestones.find((milestone) => milestone.threshold > item.milestone_threshold) ?? null;
    const bonus = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(item.bonus_amount_cents/100);
    const result = await sendTransactionalEmail({
      to:item.email,
      userId:item.user_id ?? undefined,
      emailType:"partner_growth_milestone",
      idempotencyKey:`partner-growth-milestone-${item.id}`,
      subject:`You reached ${item.milestone_threshold} Active Providers`,
      heading:`Congratulations, ${item.display_name}`,
      message:`You reached ${item.milestone_threshold} Active Providers through the BubsBookings Partner Program and earned a ${bonus} Provider Growth Bonus.${next ? ` Your next milestone is ${next.threshold} Active Providers, where you can earn an additional ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(next.bonusCents/100)} bonus.` : " You have completed every current Provider Growth milestone."}`,
      actionLabel:"View milestone progress",
      actionUrl:"/affiliate#provider-growth-milestones",
    });
    await database.query(`UPDATE affiliate_milestone_achievements SET email_attempt_count=email_attempt_count+1,
      email_sent_at=CASE WHEN $2 THEN COALESCE(email_sent_at,now()) ELSE email_sent_at END,
      email_last_error=CASE WHEN $2 THEN NULL ELSE $3 END WHERE id::text=$1`,
    [item.id,result.sent,result.skipped?"Email provider is not configured.":"Email delivery failed."]);
    if (result.sent) sent += 1;
  }
  return { queued: queued.rowCount ?? 0, sent };
}
