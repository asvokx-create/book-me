import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { database } from "./database";
import { calculateAffiliateCommission, calculateEligibleProviderFeeRevenue } from "./affiliate-rules";

export const AFFILIATE_COOKIE = "bubs_affiliate_attribution";
export const RESERVED_AFFILIATE_CODES = new Set(["ADMIN", "BUBS", "BUBSBOOKINGS", "HELP", "PRICING", "PROVIDER", "SUPPORT"]);

export function normalizeAffiliateCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) : "";
}

export function isSafeAffiliateCode(value: string) {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(value) && !RESERVED_AFFILIATE_CODES.has(value);
}

export function safeInternalDestination(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://bubsbookings.com");
    if (parsed.origin !== "https://bubsbookings.com") return "/";
    return `${parsed.pathname}${parsed.search}`.slice(0, 500);
  } catch {
    return "/";
  }
}

type DbClient = Pick<PoolClient, "query">;

export async function lockAffiliateAttribution(input: {
  client: DbClient;
  providerId: string;
  manualCode?: string;
  attributionToken?: string;
}) {
  const manualCode = normalizeAffiliateCode(input.manualCode);
  const token = input.attributionToken?.trim() ?? "";
  const match = manualCode
    ? await input.client.query<{
        affiliate_id: string; program_id: string; click_id: string | null; affiliate_code: string;
        activation_bonus_cents: number; revenue_share_basis_points: number; revenue_share_duration_months: number;
        revenue_share_starts_at: string; attribution_window_days: number; hold_period_days: number;
        minimum_payout_cents: number; eligible_provider_plans: string[]; eligible_revenue_types: string[];
      }>(`SELECT affiliate.id::text AS affiliate_id, program.id::text AS program_id, NULL::text AS click_id,
          affiliate.affiliate_code,
          COALESCE(affiliate.activation_bonus_override_cents, program.activation_bonus_cents) AS activation_bonus_cents,
          COALESCE(affiliate.revenue_share_override_basis_points, program.revenue_share_basis_points) AS revenue_share_basis_points,
          COALESCE(affiliate.revenue_share_duration_override_months, program.revenue_share_duration_months) AS revenue_share_duration_months,
          program.revenue_share_starts_at, program.attribution_window_days, program.hold_period_days,
          COALESCE(affiliate.minimum_payout_override_cents, program.minimum_payout_cents) AS minimum_payout_cents,
          program.eligible_provider_plans, program.eligible_revenue_types
        FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id = affiliate.program_id
        WHERE lower(affiliate.affiliate_code) = lower($1) AND affiliate.status = 'active'
          AND program.status = 'enabled' AND (program.starts_at IS NULL OR program.starts_at <= now())
          AND (program.ends_at IS NULL OR program.ends_at > now())
          AND NOT EXISTS (
            SELECT 1 FROM provider_profiles referred_provider
            JOIN "user" referred_owner ON referred_owner.id = referred_provider.user_id
            WHERE referred_provider.id = $2::uuid
              AND (affiliate.user_id = referred_owner.id OR lower(affiliate.email) = lower(referred_owner.email))
          ) LIMIT 1`, [manualCode, input.providerId])
    : token
      ? await input.client.query<{
          affiliate_id: string; program_id: string; click_id: string | null; affiliate_code: string;
          activation_bonus_cents: number; revenue_share_basis_points: number; revenue_share_duration_months: number;
          revenue_share_starts_at: string; attribution_window_days: number; hold_period_days: number;
          minimum_payout_cents: number; eligible_provider_plans: string[]; eligible_revenue_types: string[];
        }>(`SELECT affiliate.id::text AS affiliate_id, program.id::text AS program_id, click.id::text AS click_id,
            affiliate.affiliate_code,
            COALESCE(affiliate.activation_bonus_override_cents, program.activation_bonus_cents) AS activation_bonus_cents,
            COALESCE(affiliate.revenue_share_override_basis_points, program.revenue_share_basis_points) AS revenue_share_basis_points,
            COALESCE(affiliate.revenue_share_duration_override_months, program.revenue_share_duration_months) AS revenue_share_duration_months,
            program.revenue_share_starts_at, program.attribution_window_days, program.hold_period_days,
            COALESCE(affiliate.minimum_payout_override_cents, program.minimum_payout_cents) AS minimum_payout_cents,
            program.eligible_provider_plans, program.eligible_revenue_types
          FROM affiliate_clicks click
          JOIN affiliate_profiles affiliate ON affiliate.id = click.affiliate_id
          JOIN affiliate_programs program ON program.id = click.program_id
          WHERE click.attribution_token::text = $1 AND affiliate.status = 'active' AND program.status = 'enabled'
            AND click.created_at >= now() - make_interval(days => program.attribution_window_days)
            AND NOT EXISTS (SELECT 1 FROM affiliate_referrals used_referral WHERE used_referral.click_id = click.id)
            AND NOT EXISTS (
              SELECT 1 FROM provider_profiles referred_provider
              JOIN "user" referred_owner ON referred_owner.id = referred_provider.user_id
              WHERE referred_provider.id = $2::uuid
                AND (affiliate.user_id = referred_owner.id OR lower(affiliate.email) = lower(referred_owner.email))
            )
          ORDER BY click.created_at DESC LIMIT 1`, [token, input.providerId])
      : null;

  const terms = match?.rows[0];
  if (!terms) return { attributed: false, invalidManualCode: Boolean(manualCode) };
  const startAttribution = terms.revenue_share_starts_at === "provider_signup";
  const inserted = await input.client.query<{ id: string }>(`INSERT INTO affiliate_referrals (
      affiliate_id, provider_id, click_id, program_id, attribution_source, status,
      activation_bonus_cents, revenue_share_basis_points, revenue_share_duration_months, revenue_share_starts_at,
      attribution_window_days, hold_period_days, minimum_payout_cents, eligible_provider_plans, eligible_revenue_types,
      revenue_share_started_at, revenue_share_ends_at)
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, 'listing_published', $6, $7, $8, $9, $10, $11, $12, $13, $14,
      CASE WHEN $15 THEN now() ELSE NULL END,
      CASE WHEN $15 THEN now() + make_interval(months => $8) ELSE NULL END)
    ON CONFLICT (provider_id) DO NOTHING RETURNING id::text`, [
    terms.affiliate_id, input.providerId, terms.click_id, terms.program_id, manualCode ? "manual" : "cookie",
    terms.activation_bonus_cents, terms.revenue_share_basis_points, terms.revenue_share_duration_months,
    terms.revenue_share_starts_at, terms.attribution_window_days, terms.hold_period_days,
    terms.minimum_payout_cents, terms.eligible_provider_plans, terms.eligible_revenue_types, startAttribution,
  ]);
  return { attributed: Boolean(inserted.rows[0]), invalidManualCode: false, affiliateCode: terms.affiliate_code };
}

export async function syncAffiliateCommissionForBooking(bookingId: string, client: DbClient = database) {
  const result = await client.query<{
    referral_id: string; affiliate_id: string; provider_id: string; status: string; qualified_at: Date | null;
    activation_bonus_cents: number; revenue_share_basis_points: number; revenue_share_duration_months: number;
    revenue_share_starts_at: string; revenue_share_started_at: Date | null; revenue_share_ends_at: Date | null;
    hold_period_days: number; eligible_provider_plans: string[]; eligible_revenue_types: string[];
    booking_id: string; booking_status: string; payment_status: string; payment_release_status: string;
    provider_plan_snapshot: string | null; platform_fee_cents: number; price_cents: number; refunded_amount_cents: number;
    stripe_payment_intent_id: string | null; stripe_dispute_status: string | null;
  }>(`SELECT referral.id::text AS referral_id, referral.affiliate_id::text, referral.provider_id::text,
      referral.status, referral.qualified_at, referral.activation_bonus_cents, referral.revenue_share_basis_points,
      referral.revenue_share_duration_months, referral.revenue_share_starts_at,
      referral.revenue_share_started_at, referral.revenue_share_ends_at, referral.hold_period_days,
      referral.eligible_provider_plans, referral.eligible_revenue_types,
      booking.id::text AS booking_id, booking.status AS booking_status, booking.payment_status,
      booking.payment_release_status, booking.provider_plan_snapshot, booking.platform_fee_cents,
      booking.price_cents, booking.refunded_amount_cents, booking.stripe_payment_intent_id, booking.stripe_dispute_status
    FROM bookings booking
    JOIN affiliate_referrals referral ON referral.provider_id = booking.provider_id
    WHERE booking.id::text = $1 LIMIT 1`, [bookingId]);
  const row = result.rows[0];
  if (!row) return { processed: false };

  const disputeOpen = Boolean(row.stripe_dispute_status && !["won", "lost", "warning_closed"].includes(row.stripe_dispute_status));
  const disputeLost = row.stripe_dispute_status === "lost";
  const eligibleBooking = row.booking_status === "completed" && row.payment_status === "paid"
    && ["paid_out", "partially_released"].includes(row.payment_release_status)
    && row.refunded_amount_cents < row.price_cents && !disputeOpen && !disputeLost;
  const eligibleRevenue = row.eligible_revenue_types.includes("provider_marketplace_fee") && row.eligible_provider_plans.includes(row.provider_plan_snapshot ?? "")
    ? calculateEligibleProviderFeeRevenue({ providerMarketplaceFeeCents: row.platform_fee_cents, bookingPriceCents: row.price_cents, refundedServiceAmountCents: row.refunded_amount_cents })
    : 0;
  const targetShareAmount = eligibleBooking ? calculateAffiliateCommission(eligibleRevenue, row.revenue_share_basis_points) : 0;
  const targetActivationAmount = eligibleBooking ? row.activation_bonus_cents : 0;
  for (const kind of ["activation_bonus", "revenue_share"] as const) {
    const paid = await client.query<{ id: string; amount_cents: number; reversed_cents: number }>(`SELECT original.id::text, original.amount_cents,
        COALESCE((SELECT sum(-reversal.amount_cents)::int FROM affiliate_commissions reversal
          WHERE reversal.commission_type='reversal' AND reversal.payment_reference LIKE 'reversal:' || original.id::text || ':%'),0)::int AS reversed_cents
      FROM affiliate_commissions original WHERE original.booking_id::text=$1 AND original.commission_type=$2 AND original.status='paid' LIMIT 1`, [bookingId, kind]);
    const original = paid.rows[0];
    const target = kind === "activation_bonus" ? targetActivationAmount : targetShareAmount;
    const effectivePaid = original ? original.amount_cents - original.reversed_cents : 0;
    if (original && target < effectivePaid && !disputeOpen) {
      const adjustment = effectivePaid - target;
      const reference = `reversal:${original.id}:${target}`;
      await client.query(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,provider_id,booking_id,payment_reference,
          commission_type,eligible_revenue_cents,amount_cents,status,eligible_at,reversal_reason)
        SELECT affiliate_id,referral_id,provider_id,booking_id,$2,'reversal',0,$3,'payable',now(),$4
        FROM affiliate_commissions WHERE id=$1::uuid
          AND NOT EXISTS (SELECT 1 FROM affiliate_commissions WHERE payment_reference=$2 AND commission_type='reversal')`,
      [original.id, reference, -adjustment, disputeLost ? "Stripe chargeback was lost." : "Underlying booking revenue was refunded or became ineligible."]);
    }
  }
  if (!eligibleBooking || eligibleRevenue < 1) {
    await client.query(`UPDATE affiliate_commissions SET status = CASE WHEN status = 'paid' THEN status WHEN $2 THEN 'disputed' ELSE 'rejected' END,
      reversal_reason = CASE WHEN status = 'paid' THEN reversal_reason WHEN $2 THEN 'Underlying booking is disputed.' ELSE 'Underlying booking is not eligible.' END
      WHERE booking_id::text = $1 AND status <> 'reversed'`, [bookingId, disputeOpen]);
    return { processed: true, eligible: false };
  }

  await client.query(`UPDATE affiliate_commissions
    SET status = CASE WHEN payable_at IS NOT NULL AND payable_at <= now() THEN 'payable' ELSE 'hold' END,
        reversal_reason = NULL
    WHERE booking_id::text = $1 AND status = 'disputed'
      AND commission_type IN ('activation_bonus','revenue_share')`, [bookingId]);

  let shareStart = row.revenue_share_started_at;
  if (!shareStart && ["qualified", "first_completed_booking"].includes(row.revenue_share_starts_at)) shareStart = new Date();
  const shareEnd = row.revenue_share_ends_at ?? (shareStart ? new Date(new Date(shareStart).setMonth(new Date(shareStart).getMonth() + row.revenue_share_duration_months)) : null);
  const inShareWindow = Boolean(shareStart && shareEnd && new Date() <= shareEnd);
  const payableAt = new Date(Date.now() + row.hold_period_days * 86_400_000);
  const shareAmount = targetShareAmount;

  await client.query(`UPDATE affiliate_referrals SET status = 'qualified', qualified_at = COALESCE(qualified_at, now()),
      first_completed_booking_id = COALESCE(first_completed_booking_id, $2::uuid),
      revenue_share_started_at = COALESCE(revenue_share_started_at, $3),
      revenue_share_ends_at = COALESCE(revenue_share_ends_at, $4)
    WHERE id = $1::uuid`, [row.referral_id, bookingId, shareStart, shareEnd]);

  await client.query(`INSERT INTO affiliate_commissions (affiliate_id, referral_id, provider_id, booking_id, payment_reference,
      commission_type, eligible_revenue_cents, amount_cents, status, eligible_at, payable_at)
    SELECT $1, $2, $3, $4::uuid, $5, 'activation_bonus', 0, $6, 'hold', now(), $7
    WHERE NOT EXISTS (SELECT 1 FROM affiliate_commissions WHERE referral_id = $2 AND commission_type = 'activation_bonus')
    ON CONFLICT (referral_id) WHERE commission_type = 'activation_bonus' DO NOTHING`,
    [row.affiliate_id, row.referral_id, row.provider_id, bookingId, row.stripe_payment_intent_id, row.activation_bonus_cents, payableAt]);
  if (inShareWindow && shareAmount > 0) {
    await client.query(`INSERT INTO affiliate_commissions (affiliate_id, referral_id, provider_id, booking_id, payment_reference,
        commission_type, eligible_revenue_cents, commission_rate_basis_points, amount_cents, status, eligible_at, payable_at)
      VALUES ($1, $2, $3, $4::uuid, $5, 'revenue_share', $6, $7, $8, 'hold', now(), $9)
      ON CONFLICT (booking_id, commission_type) WHERE booking_id IS NOT NULL AND commission_type IN ('activation_bonus','revenue_share')
      DO UPDATE SET eligible_revenue_cents = EXCLUDED.eligible_revenue_cents,
        amount_cents = CASE WHEN affiliate_commissions.status = 'paid' THEN affiliate_commissions.amount_cents ELSE EXCLUDED.amount_cents END,
        updated_at = now()`, [row.affiliate_id, row.referral_id, row.provider_id, bookingId, row.stripe_payment_intent_id,
      eligibleRevenue, row.revenue_share_basis_points, shareAmount, payableAt]);
  }
  return { processed: true, eligible: true, eligibleRevenue, shareAmount };
}

export async function advanceAffiliateCommissions(client: DbClient = database) {
  await client.query(`UPDATE affiliate_referrals SET status = 'revenue_share_ended', updated_at = now()
    WHERE status = 'qualified' AND revenue_share_ends_at IS NOT NULL AND revenue_share_ends_at < now()`);
  const updated = await client.query(`UPDATE affiliate_commissions commission SET status = 'payable', approved_at = COALESCE(approved_at, now())
    FROM bookings booking
    WHERE commission.booking_id = booking.id AND commission.status IN ('pending','hold','approved')
      AND commission.payable_at <= now() AND booking.payment_status = 'paid' AND booking.status = 'completed'
      AND booking.refunded_amount_cents < booking.price_cents
      AND (booking.stripe_dispute_status IS NULL OR booking.stripe_dispute_status IN ('won','warning_closed'))
      AND NOT EXISTS (SELECT 1 FROM booking_disputes dispute WHERE dispute.booking_id = booking.id AND dispute.status IN ('open','reviewing'))
    RETURNING commission.id`);
  return updated.rowCount ?? 0;
}

export function newAttributionToken() {
  return randomUUID();
}
