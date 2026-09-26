import "server-only";

import { database } from "./database";
import { getStripe, getStripeMode, isStripeReady } from "./stripe";

type SendResult =
  | { ok: true; sent: boolean; transferId?: string }
  | { ok: false; error: string };

type ReadyPayout = { id: string; affiliate_id: string; amount_cents: number; currency: string; stripe_account_id: string; stripe_attempt_count: number };

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

export async function sendAffiliatePayout(payoutId: string, actorUserId: string): Promise<SendResult> {
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
      WHERE payout.id::text = $1 AND payout.status IN ('pending','failed')
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
