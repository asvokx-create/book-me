import "server-only";

import { database } from "./database";
import { getStripe, getStripeMode, isStripeReady } from "./stripe";

type SendResult =
  | { ok: true; sent: boolean; transferId?: string }
  | { ok: false; error: string };

type ReadyPayout = { id: string; affiliate_id: string; amount_cents: number; currency: string; stripe_account_id: string; stripe_attempt_count: number };

export type AffiliateReserveHealth = {
  obligationCents: number;
  payableCents: number;
  safetyBufferCents: number;
  requiredCents: number;
  availableCents: number | null;
  shortfallCents: number | null;
  protectedOwnerPayoutsEnabled: boolean;
};

export async function getAffiliateReserveHealth(): Promise<AffiliateReserveHealth> {
  const result = await database.query<{ obligation_cents: number; payable_cents: number }>(`SELECT
      COALESCE(sum(GREATEST(affiliate_obligation_cents,0)),0)::int AS obligation_cents,
      COALESCE(sum(GREATEST(affiliate_payable_cents,0)),0)::int AS payable_cents
    FROM (
      SELECT affiliate_id,
        COALESCE(sum(amount_cents) FILTER (WHERE status IN ('pending','hold','approved','payable')),0) AS affiliate_obligation_cents,
        COALESCE(sum(amount_cents) FILTER (WHERE status='payable'),0) AS affiliate_payable_cents
      FROM affiliate_commissions GROUP BY affiliate_id
    ) affiliate_balances`);
  const obligationCents = Number(result.rows[0]?.obligation_cents ?? 0);
  const payableCents = Number(result.rows[0]?.payable_cents ?? 0);
  const configuredBuffer = Number.parseInt(process.env.AFFILIATE_RESERVE_BUFFER_CENTS ?? "0", 10);
  const safetyBufferCents = Number.isSafeInteger(configuredBuffer) && configuredBuffer > 0 ? configuredBuffer : 0;
  const requiredCents = obligationCents + safetyBufferCents;
  let availableCents: number | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const balance = await getStripe().balance.retrieve();
      availableCents = balance.available
        .filter(item => item.currency === "usd")
        .reduce((sum, item) => sum + item.amount, 0);
    } catch (error) {
      console.error("Affiliate reserve balance check failed", error);
    }
  }
  return {
    obligationCents,
    payableCents,
    safetyBufferCents,
    requiredCents,
    availableCents,
    shortfallCents: availableCents === null ? null : Math.max(0, requiredCents - availableCents),
    protectedOwnerPayoutsEnabled: process.env.PROTECTED_OWNER_PAYOUTS_ENABLED === "true",
  };
}

export async function createAffiliatePayout(affiliateId: string, actorUserId: string | null) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`affiliate-payout-create:${affiliateId}`]);
    const existing = await client.query<{ id: string }>(`SELECT id::text FROM affiliate_payouts
      WHERE affiliate_id::text=$1 AND status IN ('pending','processing','failed')
      ORDER BY created_at LIMIT 1`, [affiliateId]);
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { ok: true as const, created: false, payoutId: existing.rows[0].id };
    }
    const affiliate = await client.query<{ minimum_cents: number }>(`SELECT
        COALESCE(affiliate.minimum_payout_override_cents,program.minimum_payout_cents)::int AS minimum_cents
      FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id=affiliate.program_id
      WHERE affiliate.id::text=$1 AND affiliate.stripe_account_id IS NOT NULL
        AND affiliate.stripe_connect_mode=$2 AND affiliate.stripe_payouts_enabled=true
        AND affiliate.payment_status='ready' AND affiliate.tax_onboarding_status='complete'
      FOR UPDATE OF affiliate`, [affiliateId, getStripeMode()]);
    if (!affiliate.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "NOT_READY" };
    }
    const payable = await client.query<{ id: string; amount_cents: number }>(`SELECT id::text,amount_cents
      FROM affiliate_commissions WHERE affiliate_id::text=$1 AND status='payable'
      ORDER BY created_at FOR UPDATE`, [affiliateId]);
    const total = payable.rows.reduce((sum, row) => sum + row.amount_cents, 0);
    if (total < affiliate.rows[0].minimum_cents || total < 1) {
      await client.query("ROLLBACK");
      return { ok: false as const, error: "MINIMUM" };
    }
    const payout = await client.query<{ id: string }>(`INSERT INTO affiliate_payouts
      (affiliate_id,amount_cents,initiated_by,payout_method) VALUES ($1,$2,$3,'stripe_connect') RETURNING id::text`,
    [affiliateId,total,actorUserId]);
    for (const commission of payable.rows) await client.query(`INSERT INTO affiliate_payout_commissions
      (payout_id,commission_id,amount_cents) VALUES ($1,$2,$3)`, [payout.rows[0].id,commission.id,commission.amount_cents]);
    await client.query(`UPDATE affiliate_commissions SET status='approved'
      WHERE id=ANY($1::uuid[])`, [payable.rows.map(row=>row.id)]);
    await client.query(`INSERT INTO affiliate_audit_log (actor_user_id,action,target_type,target_id,details)
      VALUES ($1,'payout_created','affiliate_payout',$2,$3::jsonb)`,
    [actorUserId,payout.rows[0].id,JSON.stringify({ affiliateId,total,commissionCount:payable.rowCount,automatic:actorUserId===null })]);
    await client.query("COMMIT");
    return { ok: true as const, created: true, payoutId: payout.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Affiliate payout creation failed", affiliateId, error);
    return { ok: false as const, error: "CREATE_FAILED" };
  } finally {
    client.release();
  }
}

export async function finalizeAffiliatePayoutTransfer(payoutId: string, transferId: string, mode: "test" | "live", actorUserId: string | null = null) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`affiliate-payout:${payoutId}`]);
    const completed = await client.query<{ amount_cents: number }>(`UPDATE affiliate_payouts SET status='paid',
        payout_method='stripe_connect',payout_reference=$2,stripe_transfer_id=$2,stripe_mode=$3,
        transferred_at=COALESCE(transferred_at,now()),paid_at=COALESCE(paid_at,now()),failure_reason=NULL
      WHERE id::text=$1 AND status IN ('pending','processing','failed','paid')
        AND (stripe_transfer_id IS DISTINCT FROM $2 OR status <> 'paid')
      RETURNING amount_cents`, [payoutId, transferId, mode]);
    if (completed.rows[0]) {
      await client.query(`UPDATE affiliate_commissions SET status='paid',paid_at=COALESCE(paid_at,now())
        WHERE id IN (SELECT commission_id FROM affiliate_payout_commissions WHERE payout_id=$1::uuid)`, [payoutId]);
      await client.query(`INSERT INTO affiliate_audit_log (actor_user_id,action,target_type,target_id,details)
        VALUES ($1,'affiliate_payout_sent','affiliate_payout',$2,$3::jsonb)`,
      [actorUserId, payoutId, JSON.stringify({ transferId, amountCents: completed.rows[0].amount_cents, mode })]);
    }
    await client.query("COMMIT");
    return Boolean(completed.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reverseAffiliatePayoutTransfer(payoutId: string, transferId: string, amountReversed: number) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`affiliate-payout:${payoutId}`]);
    const payout = await client.query<{ amount_cents: number }>(`SELECT amount_cents FROM affiliate_payouts
      WHERE id::text=$1 AND stripe_transfer_id=$2 FOR UPDATE`, [payoutId, transferId]);
    const fullyReversed = Boolean(payout.rows[0] && amountReversed >= payout.rows[0].amount_cents);
    const reversed = payout.rows[0] ? await client.query(`UPDATE affiliate_payouts SET status=$3,
        stripe_transfer_id=CASE WHEN $4 THEN NULL ELSE stripe_transfer_id END,
        payout_reference=CASE WHEN $4 THEN NULL ELSE payout_reference END,
        transferred_at=CASE WHEN $4 THEN NULL ELSE transferred_at END,
        paid_at=CASE WHEN $4 THEN NULL ELSE paid_at END,
        stripe_attempt_count=stripe_attempt_count+CASE WHEN $4 THEN 1 ELSE 0 END,
        failure_reason=CASE WHEN $4
          THEN 'The Stripe transfer was fully reversed before settlement. This payout can be retried.'
          ELSE 'The Stripe transfer was partially reversed. Manual review is required before any additional payout.' END
      WHERE id::text=$1 AND stripe_transfer_id=$2 RETURNING id`,
    [payoutId, transferId, fullyReversed ? "failed" : "reversed", fullyReversed]) : null;
    if (reversed?.rowCount && fullyReversed) {
      await client.query(`UPDATE affiliate_commissions SET status='approved',paid_at=NULL
        WHERE id IN (SELECT commission_id FROM affiliate_payout_commissions WHERE payout_id=$1::uuid)`, [payoutId]);
    }
    if (reversed?.rowCount) {
      await client.query(`INSERT INTO affiliate_audit_log (action,target_type,target_id,details)
        VALUES ('affiliate_stripe_transfer_reversed','affiliate_payout',$1,$2::jsonb)`,
      [payoutId, JSON.stringify({ transferId, amountReversed, fullyReversed })]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function sendAffiliatePayout(payoutId: string, actorUserId: string | null): Promise<SendResult> {
  if (!isStripeReady()) return { ok: false, error: "Stripe is not configured." };
  const mode = getStripeMode();
  const client = await database.connect();
  let payout: ReadyPayout | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`affiliate-payout:${payoutId}`]);
    const result = await client.query<ReadyPayout>(`SELECT payout.id::text, payout.affiliate_id::text,
        payout.amount_cents, payout.currency,affiliate.stripe_account_id,payout.stripe_attempt_count
      FROM affiliate_payouts payout
      JOIN affiliate_profiles affiliate ON affiliate.id = payout.affiliate_id
      WHERE payout.id::text = $1 AND (payout.status IN ('pending','failed')
        OR (payout.status='processing' AND payout.updated_at < now() - interval '10 minutes'))
        AND affiliate.stripe_connect_mode = $2
        AND affiliate.stripe_payouts_enabled = true
        AND affiliate.payment_status = 'ready'
        AND affiliate.tax_onboarding_status = 'complete'
      FOR UPDATE OF payout`, [payoutId, mode]);
    payout = result.rows[0] ?? null;
    if (!payout) {
      const existing = await client.query<{ status: string; stripe_transfer_id: string | null }>(
        "SELECT status, stripe_transfer_id FROM affiliate_payouts WHERE id::text = $1", [payoutId]);
      await client.query("ROLLBACK");
      if (existing.rows[0]?.status === "paid" && existing.rows[0].stripe_transfer_id)
        return { ok: true, sent: false, transferId: existing.rows[0].stripe_transfer_id };
      return { ok: false, error: "This payout is not ready. Confirm Stripe and tax setup, then try again." };
    }
    await client.query(`UPDATE affiliate_payouts SET status='processing', payout_method='stripe_connect',
      stripe_mode=$2, failure_reason=NULL WHERE id::text=$1`, [payoutId, mode]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Affiliate payout preparation failed", payoutId, error);
    return { ok: false, error: "The affiliate payout could not be prepared." };
  } finally {
    client.release();
  }

  if (!payout) return { ok: false, error: "The affiliate payout could not be prepared." };
  try {
    const transfer = await getStripe().transfers.create({
      amount: payout.amount_cents,
      currency: payout.currency,
      destination: payout.stripe_account_id,
      transfer_group: `affiliate_payout_${payout.id}`,
      description: "BubsBookings creator partner payout",
      metadata: { kind: "affiliate_payout", affiliatePayoutId: payout.id, affiliateId: payout.affiliate_id },
    }, { idempotencyKey: `affiliate-payout-${mode}-${payout.id}-attempt-${payout.stripe_attempt_count}` });
    await finalizeAffiliatePayoutTransfer(payout.id, transfer.id, mode, actorUserId);
    return { ok: true, sent: true, transferId: transfer.id };
  } catch (error) {
    console.error("Affiliate Stripe transfer failed", payout.id, error);
    await database.query(`UPDATE affiliate_payouts SET status='failed',
      failure_reason='Stripe could not send this payout. Check the platform balance and connected account, then retry.'
      WHERE id::text=$1 AND status='processing'`, [payout.id]);
    return { ok: false, error: "Stripe could not send this payout. Check the platform balance and connected account, then retry." };
  }
}

export async function runAutomatedAffiliatePayouts(limit = 50) {
  const candidates = await database.query<{ affiliate_id: string }>(`SELECT affiliate.id::text AS affiliate_id
    FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id=affiliate.program_id
    WHERE affiliate.stripe_account_id IS NOT NULL AND affiliate.stripe_connect_mode=$1
      AND affiliate.stripe_payouts_enabled=true AND affiliate.payment_status='ready'
      AND affiliate.tax_onboarding_status='complete'
      AND (
        EXISTS (SELECT 1 FROM affiliate_payouts payout WHERE payout.affiliate_id=affiliate.id
          AND (payout.status IN ('pending','failed') OR (payout.status='processing' AND payout.updated_at < now()-interval '10 minutes')))
        OR (SELECT COALESCE(sum(commission.amount_cents),0) FROM affiliate_commissions commission
          WHERE commission.affiliate_id=affiliate.id AND commission.status='payable')
          >= COALESCE(affiliate.minimum_payout_override_cents,program.minimum_payout_cents)
      )
    ORDER BY affiliate.created_at LIMIT $2`, [getStripeMode(),limit]);
  let created = 0;
  let sent = 0;
  const failed: string[] = [];
  for (const candidate of candidates.rows) {
    const prepared = await createAffiliatePayout(candidate.affiliate_id, null);
    if (!prepared.ok) {
      if (prepared.error !== "MINIMUM") failed.push(candidate.affiliate_id);
      continue;
    }
    if (prepared.created) created += 1;
    const result = await sendAffiliatePayout(prepared.payoutId, null);
    if (result.ok) {
      if (result.sent) sent += 1;
    } else failed.push(candidate.affiliate_id);
  }
  const reserve = await getAffiliateReserveHealth();
  await database.query(`INSERT INTO operations_checks (check_type,status,details)
    VALUES ('affiliate_payouts',$1,$2::jsonb)`, [failed.length || (reserve.shortfallCents ?? 0) > 0 ? "warning" : "ok",
    JSON.stringify({ candidates:candidates.rowCount,created,sent,failed,reserve })]);
  return { candidates:candidates.rowCount,created,sent,failed,reserve };
}

function fridayDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  if (value("weekday") !== "Friday") return null;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function runProtectedOwnerPayout(now = new Date()) {
  if (process.env.PROTECTED_OWNER_PAYOUTS_ENABLED !== "true") return { enabled: false, sent: false };
  if (!isStripeReady()) return { enabled: true, sent: false, error: "Stripe is not configured." };
  const dateKey = fridayDateKey(now);
  if (!dateKey) return { enabled: true, sent: false, reason: "not_friday" };
  const completed = await database.query<{ payout_id: string | null }>(`SELECT details->>'payoutId' AS payout_id
    FROM operations_checks
    WHERE check_type='protected_owner_payout' AND status='ok'
      AND details->>'dateKey'=$1 AND details->>'sent'='true'
    ORDER BY created_at DESC LIMIT 1`, [dateKey]);
  if (completed.rows[0]) {
    return { enabled: true, sent: false, reason: "already_sent", payoutId: completed.rows[0].payout_id };
  }
  const reserve = await getAffiliateReserveHealth();
  if (reserve.availableCents === null) return { enabled: true, sent: false, error: "Stripe balance is unavailable.", reserve };
  const minimum = Number.parseInt(process.env.OWNER_PAYOUT_MINIMUM_CENTS ?? "100", 10);
  const minimumCents = Number.isSafeInteger(minimum) && minimum > 0 ? minimum : 100;
  const payoutCents = Math.max(0, reserve.availableCents - reserve.requiredCents);
  if (payoutCents < minimumCents) {
    await database.query(`INSERT INTO operations_checks (check_type,status,details)
      VALUES ('protected_owner_payout',$1,$2::jsonb)`, [reserve.shortfallCents ? "warning" : "ok",
      JSON.stringify({ sent:false,dateKey,payoutCents,minimumCents,reserve })]);
    return { enabled: true, sent: false, reason: "no_surplus", payoutCents, reserve };
  }
  try {
    const payout = await getStripe().payouts.create({
      amount: payoutCents,
      currency: "usd",
      description: "BubsBookings protected weekly owner payout",
      metadata: { kind: "protected_owner_payout", payoutDate: dateKey, affiliateReserveCents: String(reserve.requiredCents) },
    }, { idempotencyKey: `protected-owner-payout-${getStripeMode()}-${dateKey}` });
    await database.query(`INSERT INTO operations_checks (check_type,status,details)
      VALUES ('protected_owner_payout','ok',$1::jsonb)`,
    [JSON.stringify({ sent:true,dateKey,payoutId:payout.id,payoutCents,reserve })]);
    return { enabled: true, sent: true, payoutId: payout.id, payoutCents, reserve };
  } catch (error) {
    console.error("Protected owner payout failed", error);
    await database.query(`INSERT INTO operations_checks (check_type,status,details)
      VALUES ('protected_owner_payout','warning',$1::jsonb)`,
    [JSON.stringify({ sent:false,dateKey,payoutCents,reserve,error:"Stripe could not create the protected owner payout." })]);
    return { enabled: true, sent: false, error: "Stripe could not create the protected owner payout.", reserve };
  }
}
