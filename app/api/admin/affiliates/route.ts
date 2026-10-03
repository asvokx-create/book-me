import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { isSafeAffiliateCode, normalizeAffiliateCode } from "@/lib/affiliates";
import { createAffiliatePayout, getAffiliateReserveHealth, sendAffiliatePayout } from "@/lib/affiliate-payouts";
import { enforceRateLimit } from "@/lib/request-security";
import { evaluateAffiliateMilestonesForAffiliate } from "@/lib/affiliate-milestones";

const affiliateStatuses = new Set(["under_review","approved","active","paused","rejected","suspended","terminated"]);
const commissionStatuses = new Set(["hold","approved","payable","rejected","disputed"]);

function programTerms(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : "";
  const activation = Math.round(Number(body.activationBonus) * 100);
  const shareBps = Math.round(Number(body.revenueSharePercent) * 100);
  const duration = Number(body.durationMonths);
  const attribution = Number(body.attributionDays);
  const hold = Number(body.holdDays);
  const minimum = Math.round(Number(body.minimumPayout) * 100);
  const milestoneBonusesEnabled = body.milestoneBonusesEnabled === undefined ? null : body.milestoneBonusesEnabled === true;
  const programType = body.programType === "custom" ? "custom" : "standard";
  const activationBonusEnabled = body.activationBonusEnabled === undefined ? activation > 0 : body.activationBonusEnabled === true;
  const revenueShareEnabled = body.revenueShareEnabled === undefined ? shareBps > 0 && duration > 0 : body.revenueShareEnabled === true;
  const customCampaignEnabled = body.customCampaignEnabled === true;
  const valid = Boolean(name)
    && [activation, shareBps, duration, attribution, hold, minimum].every(Number.isInteger)
    && activation >= 0 && shareBps >= 0 && shareBps <= 10000 && duration >= 0
    && attribution >= 1 && attribution <= 365 && hold >= 0 && hold <= 365 && minimum >= 0;
  return valid ? { name, description, activation, shareBps, duration, attribution, hold, minimum, milestoneBonusesEnabled,
    programType, activationBonusEnabled, revenueShareEnabled, customCampaignEnabled } : null;
}

function compensationTerms(body: Record<string, unknown>) {
  const compensationType = body.compensationType === "custom" ? "custom" : "standard";
  const activationBonusEnabled = body.activationBonusEnabled === true;
  const milestoneBonusesEnabled = body.milestoneBonusesEnabled === true;
  const revenueShareEnabled = body.revenueShareEnabled === true;
  const customCampaignEnabled = body.customCampaignEnabled === true;
  const activationBonusCents = Math.round(Number(body.activationBonus) * 100);
  const revenueShareBasisPoints = Math.round(Number(body.revenueSharePercent) * 100);
  const revenueShareDurationMonths = Number(body.durationMonths);
  const minimumPayoutCents = Math.round(Number(body.minimumPayout) * 100);
  const customCampaignAmountCents = Math.round(Number(body.customCampaignAmount) * 100);
  const customCampaignStartsOn = typeof body.customCampaignStartsOn === "string" && body.customCampaignStartsOn ? body.customCampaignStartsOn : null;
  const customCampaignEndsOn = typeof body.customCampaignEndsOn === "string" && body.customCampaignEndsOn ? body.customCampaignEndsOn : null;
  const customCampaignNotes = typeof body.customCampaignNotes === "string" ? body.customCampaignNotes.trim().slice(0, 2000) : "";
  const numbers = [activationBonusCents,revenueShareBasisPoints,revenueShareDurationMonths,minimumPayoutCents,customCampaignAmountCents];
  const valid = numbers.every(Number.isInteger) && numbers.every(value=>value>=0) && revenueShareBasisPoints<=10000
    && (!revenueShareEnabled || (revenueShareBasisPoints>0 && revenueShareDurationMonths>0))
    && (!customCampaignEnabled || (customCampaignAmountCents>0 && Boolean(customCampaignStartsOn) && Boolean(customCampaignEndsOn)))
    && (!customCampaignStartsOn || /^\d{4}-\d{2}-\d{2}$/.test(customCampaignStartsOn))
    && (!customCampaignEndsOn || /^\d{4}-\d{2}-\d{2}$/.test(customCampaignEndsOn))
    && (!customCampaignStartsOn || !customCampaignEndsOn || customCampaignEndsOn>=customCampaignStartsOn);
  return valid ? { compensationType,activationBonusEnabled,milestoneBonusesEnabled,revenueShareEnabled,customCampaignEnabled,
    activationBonusCents,revenueShareBasisPoints,revenueShareDurationMonths,minimumPayoutCents,
    customCampaignAmountCents,customCampaignStartsOn,customCampaignEndsOn,customCampaignNotes } : null;
}

async function dashboard() {
  const [summary, programs, affiliates, commissions, payouts, campaigns, recentClicks, auditHistory, milestoneAchievements, reserve] = await Promise.all([
    database.query(`SELECT
      (SELECT count(*)::int FROM affiliate_profiles WHERE status IN ('applied','under_review')) AS applications,
      (SELECT count(*)::int FROM affiliate_profiles WHERE status = 'active') AS active_affiliates,
      (SELECT count(*)::int FROM affiliate_referrals) AS provider_referrals,
      (SELECT count(*)::int FROM affiliate_referrals WHERE qualified_at IS NOT NULL) AS qualified_providers,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE status IN ('pending','hold','approved')) AS pending_cents,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE status = 'payable') AS payable_cents,
      (SELECT COALESCE(sum(amount_cents),0)::int FROM affiliate_commissions WHERE status = 'paid') AS paid_cents`),
    database.query(`SELECT id::text, name, description, activation_bonus_cents, revenue_share_basis_points,
      revenue_share_duration_months, revenue_share_starts_at, attribution_window_days, hold_period_days,
      minimum_payout_cents, payout_schedule, eligible_provider_plans, eligible_revenue_types, status, starts_at, ends_at,
      program_type, activation_bonus_enabled, revenue_share_enabled, custom_campaign_enabled,
      milestone_bonuses_enabled, active_provider_required_bookings, milestone_thresholds, milestone_bonus_cents
      FROM affiliate_programs ORDER BY created_at DESC`),
    database.query(`SELECT affiliate.id::text, affiliate.display_name, affiliate.email, affiliate.affiliate_code,
      affiliate.status, affiliate.website_url, affiliate.youtube_url, affiliate.instagram_url, affiliate.tiktok_url,
      affiliate.x_url, affiliate.facebook_url, affiliate.other_social_url,
      affiliate.primary_audience, affiliate.promotion_plan, affiliate.audience_size, affiliate.admin_notes,
      affiliate.payment_status, affiliate.tax_onboarding_status, affiliate.applied_at, affiliate.approved_at,
      affiliate.compensation_type, affiliate.milestone_bonuses_override, affiliate.milestone_backfill_approved,
      affiliate.activation_bonus_enabled_override, affiliate.revenue_share_enabled_override,
      affiliate.custom_campaign_enabled_override, affiliate.custom_campaign_amount_cents,
      affiliate.custom_campaign_starts_on, affiliate.custom_campaign_ends_on, affiliate.custom_campaign_notes,
      affiliate.stripe_account_id,affiliate.stripe_connect_mode,affiliate.stripe_details_submitted,
      affiliate.stripe_payouts_enabled,cardinality(affiliate.stripe_requirements_due)::int AS stripe_requirements_count,
      program.id::text AS program_id, program.name AS program_name,
      COALESCE(affiliate.activation_bonus_enabled_override,program.activation_bonus_enabled,false) AS activation_bonus_enabled,
      COALESCE(affiliate.revenue_share_enabled_override,program.revenue_share_enabled,false) AS revenue_share_enabled,
      COALESCE(affiliate.custom_campaign_enabled_override,program.custom_campaign_enabled,false) AS custom_campaign_enabled,
      COALESCE(affiliate.activation_bonus_override_cents,program.activation_bonus_cents) AS activation_bonus_cents,
      COALESCE(affiliate.revenue_share_override_basis_points,program.revenue_share_basis_points) AS revenue_share_basis_points,
      COALESCE(affiliate.revenue_share_duration_override_months,program.revenue_share_duration_months) AS revenue_share_duration_months,
      COALESCE(affiliate.minimum_payout_override_cents,program.minimum_payout_cents) AS minimum_payout_cents,
      COALESCE(affiliate.milestone_bonuses_override,program.milestone_bonuses_enabled,false) AS milestone_bonuses_enabled,
      program.milestone_thresholds, program.milestone_bonus_cents,
      (SELECT count(*)::int FROM affiliate_clicks click WHERE click.affiliate_id=affiliate.id) AS clicks,
      (SELECT count(*)::int FROM affiliate_referrals referral WHERE referral.affiliate_id=affiliate.id) AS referrals,
      (SELECT count(*)::int FROM affiliate_referrals referral WHERE referral.affiliate_id=affiliate.id AND referral.qualified_at IS NOT NULL) AS qualified,
      (SELECT count(*)::int FROM affiliate_referrals referral
        WHERE referral.affiliate_id=affiliate.id AND referral.status<>'disqualified'
          AND (SELECT count(DISTINCT booking.id) FROM bookings booking
            JOIN provider_profiles milestone_provider ON milestone_provider.id=booking.provider_id AND milestone_provider.is_active=true
            WHERE booking.provider_id=referral.provider_id AND booking.status='completed' AND booking.payment_status='paid'
              AND booking.payment_release_status IN ('paid_out','partially_released') AND booking.payout_released_at IS NOT NULL
              AND booking.payout_released_at + make_interval(days => referral.hold_period_days) <= now()
              AND booking.refunded_amount_cents < booking.price_cents
              AND (booking.stripe_dispute_status IS NULL OR booking.stripe_dispute_status IN ('won','warning_closed'))
              AND NOT EXISTS (SELECT 1 FROM booking_disputes dispute WHERE dispute.booking_id=booking.id AND dispute.status IN ('open','reviewing'))
              AND NOT EXISTS (SELECT 1 FROM account_restrictions restriction WHERE restriction.user_id=milestone_provider.user_id
                AND restriction.status IN ('suspended','banned') AND (restriction.expires_at IS NULL OR restriction.expires_at>now()))) >= referral.active_provider_required_bookings
      ) AS active_provider_count,
      (SELECT count(*)::int FROM affiliate_milestone_achievements achievement WHERE achievement.affiliate_id=affiliate.id AND achievement.reversed_at IS NULL) AS completed_milestones,
      (SELECT count(DISTINCT commission.booking_id)::int FROM affiliate_commissions commission WHERE commission.affiliate_id=affiliate.id AND commission.booking_id IS NOT NULL) AS bookings_generated,
      (SELECT COALESCE(sum(commission.eligible_revenue_cents),0)::int FROM affiliate_commissions commission WHERE commission.affiliate_id=affiliate.id AND commission.commission_type='revenue_share' AND commission.status<>'reversed') AS eligible_revenue_cents,
      (SELECT COALESCE(sum(commission.amount_cents),0)::int FROM affiliate_commissions commission WHERE commission.affiliate_id=affiliate.id AND commission.status IN ('pending','hold','approved')) AS pending_cents,
      (SELECT COALESCE(sum(commission.amount_cents),0)::int FROM affiliate_commissions commission WHERE commission.affiliate_id=affiliate.id AND commission.status='payable') AS payable_cents,
      (SELECT COALESCE(sum(commission.amount_cents),0)::int FROM affiliate_commissions commission WHERE commission.affiliate_id=affiliate.id AND commission.status='paid') AS paid_cents
      FROM affiliate_profiles affiliate LEFT JOIN affiliate_programs program ON program.id = affiliate.program_id
      GROUP BY affiliate.id, program.id ORDER BY affiliate.applied_at DESC`),
    database.query(`SELECT commission.id::text, commission.commission_type, commission.eligible_revenue_cents,
      commission.commission_rate_basis_points, commission.amount_cents, commission.status, commission.created_at,
      commission.payable_at, commission.booking_id::text, affiliate.display_name AS affiliate_name,
      provider.business_name AS provider_name
      FROM affiliate_commissions commission JOIN affiliate_profiles affiliate ON affiliate.id = commission.affiliate_id
      JOIN provider_profiles provider ON provider.id = commission.provider_id ORDER BY commission.created_at DESC LIMIT 150`),
    database.query(`SELECT payout.id::text, payout.amount_cents, payout.status, payout.payout_method,
      payout.payout_reference,payout.stripe_transfer_id,payout.stripe_mode,payout.failure_reason,
      payout.created_at,payout.paid_at,payout.transferred_at,
      affiliate.display_name AS affiliate_name, count(link.commission_id)::int AS commission_count
      FROM affiliate_payouts payout JOIN affiliate_profiles affiliate ON affiliate.id = payout.affiliate_id
      LEFT JOIN affiliate_payout_commissions link ON link.payout_id = payout.id
      GROUP BY payout.id, affiliate.display_name ORDER BY payout.created_at DESC LIMIT 100`),
    database.query(`SELECT campaign.id::text, campaign.campaign_name, campaign.fixed_amount_cents,
      campaign.currency, campaign.payment_status, campaign.campaign_starts_on, campaign.campaign_ends_on,
      campaign.affiliate_code, campaign.revenue_share_basis_points, campaign.revenue_share_duration_months,
      campaign.notes, campaign.payment_reference, campaign.paid_at, campaign.created_at,
      affiliate.display_name AS affiliate_name, program.name AS program_name
      FROM creator_campaign_payments campaign
      JOIN affiliate_profiles affiliate ON affiliate.id = campaign.affiliate_id
      LEFT JOIN affiliate_programs program ON program.id = campaign.program_id
      ORDER BY campaign.created_at DESC LIMIT 100`),
    database.query(`SELECT click.id::text, click.affiliate_code, click.landing_path, click.utm_campaign,
      click.created_at, affiliate.display_name AS affiliate_name
      FROM affiliate_clicks click JOIN affiliate_profiles affiliate ON affiliate.id = click.affiliate_id
      ORDER BY click.created_at DESC LIMIT 100`),
    database.query(`SELECT audit.id::text, audit.action, audit.target_type, audit.target_id, audit.created_at,
      actor.name AS actor_name FROM affiliate_audit_log audit LEFT JOIN "user" actor ON actor.id=audit.actor_user_id
      ORDER BY audit.created_at DESC LIMIT 100`),
    database.query(`SELECT achievement.id::text,achievement.milestone_threshold,achievement.bonus_amount_cents,
      achievement.active_provider_count,achievement.earned_at,achievement.reversed_at,achievement.reversal_reason,
      achievement.email_sent_at,commission.status AS commission_status,commission.paid_at,
      affiliate.display_name AS affiliate_name
      FROM affiliate_milestone_achievements achievement
      JOIN affiliate_profiles affiliate ON affiliate.id=achievement.affiliate_id
      LEFT JOIN affiliate_commissions commission ON commission.id=achievement.commission_id
      ORDER BY achievement.earned_at DESC LIMIT 150`),
    getAffiliateReserveHealth(),
  ]);
  return { summary: summary.rows[0], reserve, programs: programs.rows, affiliates: affiliates.rows, commissions: commissions.rows, payouts: payouts.rows, campaigns: campaigns.rows, recentClicks: recentClicks.rows, auditHistory: auditHistory.rows, milestoneAchievements: milestoneAchievements.rows };
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json(await dashboard(), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-affiliate", limit: 40 })) return NextResponse.json({ error: "Too many admin actions." }, { status: 429 });
  const body = await request.json() as Record<string, unknown>;
  if (body.action === "campaign_create") {
    const affiliateId = typeof body.affiliateId === "string" ? body.affiliateId : "";
    const programId = typeof body.programId === "string" && body.programId ? body.programId : null;
    const campaignName = typeof body.campaignName === "string" ? body.campaignName.trim().slice(0, 160) : "";
    const amountCents = Math.round(Number(body.fixedAmount) * 100);
    const paymentStatus = typeof body.paymentStatus === "string" ? body.paymentStatus : "planned";
    const startsOn = typeof body.startsOn === "string" && body.startsOn ? body.startsOn : null;
    const endsOn = typeof body.endsOn === "string" && body.endsOn ? body.endsOn : null;
    const shareBasisPoints = body.revenueSharePercent === "" || body.revenueSharePercent == null ? null : Math.round(Number(body.revenueSharePercent) * 100);
    const durationMonths = body.durationMonths === "" || body.durationMonths == null ? null : Number(body.durationMonths);
    const suppliedCode = normalizeAffiliateCode(body.affiliateCode);
    if (!affiliateId || !campaignName || !Number.isInteger(amountCents) || amountCents < 0 || !new Set(["planned","approved","paid","cancelled"]).has(paymentStatus)
      || (shareBasisPoints !== null && (!Number.isInteger(shareBasisPoints) || shareBasisPoints < 0 || shareBasisPoints > 10000))
      || (durationMonths !== null && (!Number.isInteger(durationMonths) || durationMonths < 0))
      || (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) || (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) || (startsOn && endsOn && endsOn < startsOn)) {
      return NextResponse.json({ error: "Enter valid campaign terms." }, { status: 400 });
    }
    const result = await database.query<{ id: string }>(`INSERT INTO creator_campaign_payments (
        affiliate_id, program_id, campaign_name, fixed_amount_cents, payment_status, campaign_starts_on,
        campaign_ends_on, affiliate_code, revenue_share_basis_points, revenue_share_duration_months,
        notes, payment_reference, paid_at, created_by)
      SELECT affiliate.id, $2::uuid, $3, $4, $5, $6::date, $7::date,
        COALESCE(NULLIF($8,''), affiliate.affiliate_code), $9, $10, $11, $12,
        CASE WHEN $5='paid' THEN now() ELSE NULL END, $13
      FROM affiliate_profiles affiliate WHERE affiliate.id::text=$1
      RETURNING id::text`, [affiliateId, programId, campaignName, amountCents, paymentStatus, startsOn, endsOn,
      suppliedCode, shareBasisPoints, durationMonths, typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "",
      typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0, 200) || null : null, session.user.id]);
    if (!result.rowCount) return NextResponse.json({ error: "Choose a valid creator." }, { status: 404 });
    await audit(session.user.id, "creator_campaign_created", "creator_campaign", result.rows[0].id, { affiliateId, programId, campaignName, amountCents, paymentStatus });
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  }
  if (body.action !== "program_create") return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  const terms = programTerms(body);
  if (!terms) return NextResponse.json({ error: "Enter valid program terms." }, { status: 400 });
  try {
    const result = await database.query<{ id: string }>(`INSERT INTO affiliate_programs (name, description, program_type,
        activation_bonus_enabled, activation_bonus_cents, revenue_share_enabled,
        revenue_share_basis_points, revenue_share_duration_months, attribution_window_days, hold_period_days,
        minimum_payout_cents, milestone_bonuses_enabled, custom_campaign_enabled, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft') RETURNING id::text`,
    [terms.name,terms.description,terms.programType,terms.activationBonusEnabled,terms.activation,terms.revenueShareEnabled,
      terms.shareBps,terms.duration,terms.attribution,terms.hold,terms.minimum,terms.milestoneBonusesEnabled,terms.customCampaignEnabled]);
    await audit(session.user.id, "program_created", "affiliate_program", result.rows[0].id, terms);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "A program with that name already exists." }, { status: 409 });
    return NextResponse.json({ error: "The affiliate program could not be created." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-affiliate", limit: 40 })) return NextResponse.json({ error: "Too many admin actions." }, { status: 429 });
  const body = await request.json() as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (action === "payout_send") {
    const result = await sendAffiliatePayout(targetId, session.user.id);
    return result.ok
      ? NextResponse.json({ ok: true, transferId: result.transferId })
      : NextResponse.json({ error: result.error }, { status: 409 });
  }
  if (action === "payout_create") {
    const result = await createAffiliatePayout(targetId, session.user.id);
    if (result.ok) return NextResponse.json({ ok: true, payoutId: result.payoutId });
    if (result.error === "MINIMUM") return NextResponse.json({ error: "The payable balance has not reached this partner's minimum payout." }, { status: 409 });
    if (result.error === "NOT_READY") return NextResponse.json({ error: "Complete and verify this partner's payment and tax readiness before creating a payout." }, { status: 409 });
    return NextResponse.json({ error: "The affiliate payout could not be created." }, { status: 409 });
  }
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (action === "affiliate_status") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!affiliateStatuses.has(status)) throw new Error("INVALID");
      const code = normalizeAffiliateCode(body.code);
      if (["approved","active"].includes(status) && !isSafeAffiliateCode(code)) throw new Error("CODE");
      const requestedProgramId = typeof body.programId === "string" ? body.programId : "";
      let reviewedTerms: ReturnType<typeof compensationTerms> = null;
      if (["approved","active"].includes(status)) {
        if (!requestedProgramId) throw new Error("PROGRAM");
        const selectedProgram = await client.query<{
          program_type:"standard"|"custom";activation_bonus_enabled:boolean;milestone_bonuses_enabled:boolean;
          revenue_share_enabled:boolean;custom_campaign_enabled:boolean;activation_bonus_cents:number;
          revenue_share_basis_points:number;revenue_share_duration_months:number;minimum_payout_cents:number;
        }>(`SELECT program_type,activation_bonus_enabled,milestone_bonuses_enabled,revenue_share_enabled,
          custom_campaign_enabled,activation_bonus_cents,revenue_share_basis_points,revenue_share_duration_months,
          minimum_payout_cents FROM affiliate_programs WHERE id::text=$1 AND status='enabled'`, [requestedProgramId]);
        if (!selectedProgram.rowCount) throw new Error("PROGRAM");
        if (body.compensationConfigured === true) reviewedTerms = compensationTerms(body);
        else if (status === "approved") {
          const defaults=selectedProgram.rows[0];
          reviewedTerms=compensationTerms({compensationType:defaults.program_type,
            activationBonusEnabled:defaults.activation_bonus_enabled,milestoneBonusesEnabled:defaults.milestone_bonuses_enabled,
            revenueShareEnabled:defaults.revenue_share_enabled,customCampaignEnabled:defaults.custom_campaign_enabled,
            activationBonus:defaults.activation_bonus_cents/100,revenueSharePercent:defaults.revenue_share_basis_points/100,
            durationMonths:defaults.revenue_share_duration_months,minimumPayout:defaults.minimum_payout_cents/100,
            customCampaignAmount:0,customCampaignStartsOn:"",customCampaignEndsOn:""});
        }
        if ((body.compensationConfigured === true || status === "approved") && !reviewedTerms) throw new Error("INVALID");
      }
      const result = await client.query(`UPDATE affiliate_profiles SET status=$2, affiliate_code=CASE WHEN $3='' THEN affiliate_code ELSE $3 END,
        program_id=COALESCE($4::uuid, program_id), approved_at=CASE WHEN $2 IN ('approved','active') THEN COALESCE(approved_at,now()) ELSE approved_at END,
        activated_at=CASE WHEN $2='active' THEN COALESCE(activated_at,now()) ELSE activated_at END, admin_notes=CASE WHEN $5='' THEN admin_notes ELSE $5 END,
        compensation_type=COALESCE($6,compensation_type),activation_bonus_enabled_override=COALESCE($7,activation_bonus_enabled_override),
        milestone_bonuses_override=COALESCE($8,milestone_bonuses_override),revenue_share_enabled_override=COALESCE($9,revenue_share_enabled_override),
        custom_campaign_enabled_override=COALESCE($10,custom_campaign_enabled_override),activation_bonus_override_cents=COALESCE($11,activation_bonus_override_cents),
        revenue_share_override_basis_points=COALESCE($12,revenue_share_override_basis_points),revenue_share_duration_override_months=COALESCE($13,revenue_share_duration_override_months),
        minimum_payout_override_cents=COALESCE($14,minimum_payout_override_cents),custom_campaign_amount_cents=COALESCE($15,custom_campaign_amount_cents),
        custom_campaign_starts_on=COALESCE($16::date,custom_campaign_starts_on),custom_campaign_ends_on=COALESCE($17::date,custom_campaign_ends_on),
        custom_campaign_notes=CASE WHEN $18='' THEN custom_campaign_notes ELSE $18 END,
        milestone_backfill_approved=CASE WHEN $2 IN ('approved','active') AND $8=true THEN true ELSE milestone_backfill_approved END
        WHERE id::text=$1`, [targetId,status,code,requestedProgramId||null,reason,
        reviewedTerms?.compensationType??null,reviewedTerms?.activationBonusEnabled??null,reviewedTerms?.milestoneBonusesEnabled??null,
        reviewedTerms?.revenueShareEnabled??null,reviewedTerms?.customCampaignEnabled??null,reviewedTerms?.activationBonusCents??null,
        reviewedTerms?.revenueShareBasisPoints??null,reviewedTerms?.revenueShareDurationMonths??null,reviewedTerms?.minimumPayoutCents??null,
        reviewedTerms?.customCampaignAmountCents??null,reviewedTerms?.customCampaignStartsOn??null,reviewedTerms?.customCampaignEndsOn??null,
        reviewedTerms?.customCampaignNotes??""]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      if (reviewedTerms) await syncCompensationCampaign(client,targetId,requestedProgramId,code,reviewedTerms,session.user.id);
      await audit(session.user.id, "affiliate_status_changed", "affiliate", targetId, { status, code, programId: requestedProgramId||null, compensation:reviewedTerms, reason }, client);
    } else if (action === "campaign_status") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!new Set(["planned","approved","paid","cancelled"]).has(status)) throw new Error("INVALID");
      const result = await client.query(`UPDATE creator_campaign_payments SET payment_status=$2,
        payment_reference=CASE WHEN $3='' THEN payment_reference ELSE $3 END,
        notes=CASE WHEN $4='' THEN notes ELSE concat_ws(E'\n',NULLIF(notes,''),$4) END,
        paid_at=CASE WHEN $2='paid' THEN COALESCE(paid_at,now()) ELSE paid_at END
        WHERE id::text=$1`, [targetId,status,typeof body.paymentReference === "string" ? body.paymentReference.trim().slice(0,200) : "",reason]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id,"creator_campaign_status_changed","creator_campaign",targetId,{status,reason},client);
    } else if (action === "affiliate_overrides") {
      const terms=compensationTerms(body);
      if (!terms) throw new Error("INVALID");
      const previous=await client.query<{milestone_bonuses_enabled:boolean;program_id:string;affiliate_code:string}>(`SELECT
        COALESCE(affiliate.milestone_bonuses_override,program.milestone_bonuses_enabled,false) AS milestone_bonuses_enabled,
        affiliate.program_id::text,affiliate.affiliate_code FROM affiliate_profiles affiliate
        JOIN affiliate_programs program ON program.id=affiliate.program_id WHERE affiliate.id::text=$1 FOR UPDATE`,[targetId]);
      if(!previous.rows[0])throw new Error("NOT_FOUND");
      const result = await client.query(`UPDATE affiliate_profiles SET compensation_type=$2,activation_bonus_enabled_override=$3,
        milestone_bonuses_override=$4,revenue_share_enabled_override=$5,custom_campaign_enabled_override=$6,
        activation_bonus_override_cents=$7,revenue_share_override_basis_points=$8,revenue_share_duration_override_months=$9,
        minimum_payout_override_cents=$10,custom_campaign_amount_cents=$11,custom_campaign_starts_on=$12::date,
        custom_campaign_ends_on=$13::date,custom_campaign_notes=$14,
        milestone_backfill_approved=CASE WHEN $4=true AND $15=false THEN false ELSE milestone_backfill_approved END
        WHERE id::text=$1`,
      [targetId,terms.compensationType,terms.activationBonusEnabled,terms.milestoneBonusesEnabled,terms.revenueShareEnabled,
        terms.customCampaignEnabled,terms.activationBonusCents,terms.revenueShareBasisPoints,terms.revenueShareDurationMonths,
        terms.minimumPayoutCents,terms.customCampaignAmountCents,terms.customCampaignStartsOn,terms.customCampaignEndsOn,
        terms.customCampaignNotes,previous.rows[0].milestone_bonuses_enabled]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await syncCompensationCampaign(client,targetId,previous.rows[0].program_id,previous.rows[0].affiliate_code,terms,session.user.id);
      await audit(session.user.id, "affiliate_overrides_changed", "affiliate", targetId, { compensation:terms }, client);
    } else if (action === "affiliate_milestones") {
      const enabled = body.enabled === true;
      const result = await client.query(`UPDATE affiliate_profiles SET milestone_bonuses_override=$2,
        milestone_backfill_approved=CASE WHEN $2 THEN false ELSE milestone_backfill_approved END WHERE id::text=$1`, [targetId,enabled]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id,"affiliate_milestones_changed","affiliate",targetId,{enabled,reason},client);
    } else if (action === "milestone_backfill_approve") {
      if (!reason) throw new Error("INVALID");
      const result = await client.query(`UPDATE affiliate_profiles SET milestone_backfill_approved=true,
        admin_notes=concat_ws(E'\n',NULLIF(admin_notes,''),$2) WHERE id::text=$1`,[targetId,reason]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id,"milestone_backfill_approved","affiliate",targetId,{reason},client);
      await evaluateAffiliateMilestonesForAffiliate(targetId,client);
    } else if (action === "affiliate_payment_readiness") {
      const ready = body.ready === true;
      if (ready && !reason) throw new Error("INVALID");
      const result = await client.query(`UPDATE affiliate_profiles SET tax_onboarding_status=$2,
        admin_notes=CASE WHEN $3='' THEN admin_notes ELSE $3 END WHERE id::text=$1`,
      [targetId,ready?"complete":"requires_attention",reason]);
      if(!result.rowCount)throw new Error("NOT_FOUND");
      await audit(session.user.id,"affiliate_payment_readiness_changed","affiliate",targetId,{ready,reason},client);
    } else if (action === "program_status") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!new Set(["draft","enabled","disabled"]).has(status)) throw new Error("INVALID");
      await client.query("UPDATE affiliate_programs SET status=$2 WHERE id::text=$1", [targetId,status]);
      await audit(session.user.id, "program_status_changed", "affiliate_program", targetId, { status }, client);
    } else if (action === "program_milestones") {
      const enabled = body.enabled === true;
      const result = await client.query("UPDATE affiliate_programs SET milestone_bonuses_enabled=$2 WHERE id::text=$1",[targetId,enabled]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id,"program_milestones_changed","affiliate_program",targetId,{enabled,reason},client);
    } else if (action === "program_update") {
      const terms = programTerms(body);
      if (!terms) throw new Error("INVALID");
      const result = await client.query(`UPDATE affiliate_programs SET name=$2,description=$3,program_type=$4,
        activation_bonus_enabled=$5,activation_bonus_cents=$6,revenue_share_enabled=$7,
        revenue_share_basis_points=$8,revenue_share_duration_months=$9,attribution_window_days=$10,
        hold_period_days=$11,minimum_payout_cents=$12,milestone_bonuses_enabled=COALESCE($13,milestone_bonuses_enabled),
        custom_campaign_enabled=$14 WHERE id::text=$1`,
      [targetId,terms.name,terms.description,terms.programType,terms.activationBonusEnabled,terms.activation,
        terms.revenueShareEnabled,terms.shareBps,terms.duration,terms.attribution,terms.hold,terms.minimum,
        terms.milestoneBonusesEnabled,terms.customCampaignEnabled]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id,"program_updated","affiliate_program",targetId,terms,client);
    } else if (action === "commission_status") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!commissionStatuses.has(status) || (["rejected","disputed"].includes(status) && !reason)) throw new Error("INVALID");
      const result = await client.query(`UPDATE affiliate_commissions SET status=$2, admin_notes=CASE WHEN $3='' THEN admin_notes ELSE $3 END,
        approved_at=CASE WHEN $2 IN ('approved','payable') THEN COALESCE(approved_at,now()) ELSE approved_at END
        WHERE id::text=$1 AND status <> 'paid'`, [targetId,status,reason]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id, "commission_status_changed", "affiliate_commission", targetId, { status, reason }, client);
    } else if (action === "commission_reversal") {
      if (!reason) throw new Error("INVALID");
      const original = await client.query<{ id:string; affiliate_id:string; referral_id:string; provider_id:string; booking_id:string|null; amount_cents:number; status:string }>(`SELECT id::text,affiliate_id::text,referral_id::text,provider_id::text,booking_id::text,amount_cents,status FROM affiliate_commissions WHERE id::text=$1 AND commission_type<>'reversal' FOR UPDATE`,[targetId]);
      const row=original.rows[0]; if(!row)throw new Error("NOT_FOUND");
      if(row.status==="paid")await client.query(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,provider_id,booking_id,payment_reference,commission_type,amount_cents,status,eligible_at,reversal_reason,admin_notes)
        VALUES ($1,$2,$3,$4::uuid,$5,'reversal',$6,'payable',now(),$7,$7)`,[row.affiliate_id,row.referral_id,row.provider_id,row.booking_id,`admin-reversal:${row.id}:${Date.now()}`,-Math.abs(row.amount_cents),reason]);
      await client.query(`UPDATE affiliate_commissions SET status=CASE WHEN status='paid' THEN status ELSE 'reversed' END,reversal_reason=$2 WHERE id::text=$1`,[targetId,reason]);
      await audit(session.user.id,"commission_reversed","affiliate_commission",targetId,{reason,amountCents:row.amount_cents},client);
    } else if (action === "manual_adjustment") {
      const amount=Math.round(Number(body.amount)*100); if(!Number.isInteger(amount)||amount===0||!reason)throw new Error("INVALID");
      const referral=await client.query<{id:string;provider_id:string}>(`SELECT id::text,provider_id::text FROM affiliate_referrals WHERE affiliate_id::text=$1 ORDER BY attributed_at DESC LIMIT 1`,[targetId]);
      if(!referral.rows[0])throw new Error("NOT_FOUND");
      const adjustment=await client.query<{id:string}>(`INSERT INTO affiliate_commissions (affiliate_id,referral_id,provider_id,commission_type,amount_cents,status,eligible_at,payable_at,admin_notes)
        VALUES ($1,$2,$3,'manual_adjustment',$4,'payable',now(),now(),$5) RETURNING id::text`,[targetId,referral.rows[0].id,referral.rows[0].provider_id,amount,reason]);
      await audit(session.user.id,"manual_adjustment_created","affiliate_commission",adjustment.rows[0].id,{affiliateId:targetId,amount,reason},client);
    } else throw new Error("INVALID");
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message === "CODE") return NextResponse.json({ error: "Use a unique code with 3–32 letters, numbers, hyphens, or underscores." }, { status: 400 });
    if (message === "PROGRAM") return NextResponse.json({ error: "Choose an enabled affiliate program." }, { status: 400 });
    if (message === "MINIMUM") return NextResponse.json({ error: "The payable balance has not reached this partner's minimum payout." }, { status: 409 });
    if (message === "NOT_READY") return NextResponse.json({ error: "Complete and verify this partner's payment and tax readiness before creating a payout." }, { status: 409 });
    if (message === "NOT_FOUND") return NextResponse.json({ error: "That record is not available for this action." }, { status: 404 });
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: action === "program_update" ? "A program with that name already exists." : "That affiliate code is already in use." }, { status: 409 });
    return NextResponse.json({ error: message === "INVALID" ? "Check the requested action and required reason." : "The affiliate action could not be completed." }, { status: 400 });
  } finally { client.release(); }
}

async function audit(actor: string, action: string, targetType: string, targetId: string, details: unknown, client: { query: typeof database.query } = database) {
  await client.query(`INSERT INTO affiliate_audit_log (actor_user_id,action,target_type,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)`, [actor,action,targetType,targetId,JSON.stringify(details)]);
}

async function syncCompensationCampaign(
  client:{query:typeof database.query}, affiliateId:string, programId:string, affiliateCode:string,
  terms:NonNullable<ReturnType<typeof compensationTerms>>, actorId:string,
) {
  if (!terms.customCampaignEnabled) {
    await client.query(`UPDATE creator_campaign_payments SET payment_status='cancelled'
      WHERE affiliate_id::text=$1 AND is_compensation_default=true AND payment_status IN ('planned','approved')`,[affiliateId]);
    return;
  }
  await client.query(`INSERT INTO creator_campaign_payments
      (affiliate_id,program_id,campaign_name,fixed_amount_cents,payment_status,campaign_starts_on,campaign_ends_on,
       affiliate_code,revenue_share_basis_points,revenue_share_duration_months,notes,created_by,is_compensation_default)
    VALUES ($1,$2::uuid,'Partner compensation campaign',$3,'planned',$4::date,$5::date,$6,$7,$8,$9,$10,true)
    ON CONFLICT (affiliate_id) WHERE is_compensation_default=true DO UPDATE SET
      program_id=EXCLUDED.program_id,fixed_amount_cents=EXCLUDED.fixed_amount_cents,
      campaign_starts_on=EXCLUDED.campaign_starts_on,campaign_ends_on=EXCLUDED.campaign_ends_on,
      affiliate_code=EXCLUDED.affiliate_code,revenue_share_basis_points=EXCLUDED.revenue_share_basis_points,
      revenue_share_duration_months=EXCLUDED.revenue_share_duration_months,notes=EXCLUDED.notes,
      payment_status=CASE WHEN creator_campaign_payments.payment_status='paid' THEN 'paid' ELSE 'planned' END`,
  [affiliateId,programId,terms.customCampaignAmountCents,terms.customCampaignStartsOn,terms.customCampaignEndsOn,
    affiliateCode,terms.revenueShareEnabled?terms.revenueShareBasisPoints:null,
    terms.revenueShareEnabled?terms.revenueShareDurationMonths:null,terms.customCampaignNotes,actorId]);
}
