import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { isSafeAffiliateCode, normalizeAffiliateCode } from "@/lib/affiliates";
import { sendAffiliatePayout } from "@/lib/affiliate-payouts";
import { enforceRateLimit } from "@/lib/request-security";

const affiliateStatuses = new Set(["under_review","approved","active","paused","rejected","suspended","terminated"]);
const commissionStatuses = new Set(["hold","approved","payable","rejected","disputed"]);

async function dashboard() {
  const [summary, programs, affiliates, commissions, payouts, recentClicks, auditHistory] = await Promise.all([
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
      minimum_payout_cents, payout_schedule, eligible_provider_plans, eligible_revenue_types, status, starts_at, ends_at
      FROM affiliate_programs ORDER BY created_at DESC`),
    database.query(`SELECT affiliate.id::text, affiliate.display_name, affiliate.email, affiliate.affiliate_code,
      affiliate.status, affiliate.website_url, affiliate.youtube_url, affiliate.instagram_url, affiliate.tiktok_url,
      affiliate.x_url, affiliate.facebook_url, affiliate.other_social_url,
      affiliate.primary_audience, affiliate.promotion_plan, affiliate.audience_size, affiliate.admin_notes,
      affiliate.payment_status, affiliate.tax_onboarding_status, affiliate.applied_at, affiliate.approved_at,
      affiliate.stripe_account_id,affiliate.stripe_connect_mode,affiliate.stripe_details_submitted,
      affiliate.stripe_payouts_enabled,cardinality(affiliate.stripe_requirements_due)::int AS stripe_requirements_count,
      program.id::text AS program_id, program.name AS program_name,
      (SELECT count(*)::int FROM affiliate_clicks click WHERE click.affiliate_id=affiliate.id) AS clicks,
      (SELECT count(*)::int FROM affiliate_referrals referral WHERE referral.affiliate_id=affiliate.id) AS referrals,
      (SELECT count(*)::int FROM affiliate_referrals referral WHERE referral.affiliate_id=affiliate.id AND referral.qualified_at IS NOT NULL) AS qualified,
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
    database.query(`SELECT click.id::text, click.affiliate_code, click.landing_path, click.utm_campaign,
      click.created_at, affiliate.display_name AS affiliate_name
      FROM affiliate_clicks click JOIN affiliate_profiles affiliate ON affiliate.id = click.affiliate_id
      ORDER BY click.created_at DESC LIMIT 100`),
    database.query(`SELECT audit.id::text, audit.action, audit.target_type, audit.target_id, audit.created_at,
      actor.name AS actor_name FROM affiliate_audit_log audit LEFT JOIN "user" actor ON actor.id=audit.actor_user_id
      ORDER BY audit.created_at DESC LIMIT 100`),
  ]);
  return { summary: summary.rows[0], programs: programs.rows, affiliates: affiliates.rows, commissions: commissions.rows, payouts: payouts.rows, recentClicks: recentClicks.rows, auditHistory: auditHistory.rows };
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
  if (body.action !== "program_create") return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const activation = Math.round(Number(body.activationBonus) * 100);
  const shareBps = Math.round(Number(body.revenueSharePercent) * 100);
  const duration = Number(body.durationMonths); const attribution = Number(body.attributionDays); const hold = Number(body.holdDays); const minimum = Math.round(Number(body.minimumPayout) * 100);
  if (!name || ![activation, shareBps, duration, attribution, hold, minimum].every(Number.isInteger) || activation < 0 || shareBps < 0 || shareBps > 10000 || duration < 0 || attribution < 1 || hold < 0 || minimum < 0) return NextResponse.json({ error: "Enter valid program terms." }, { status: 400 });
  const result = await database.query<{ id: string }>(`INSERT INTO affiliate_programs (name, description, activation_bonus_cents,
      revenue_share_basis_points, revenue_share_duration_months, attribution_window_days, hold_period_days, minimum_payout_cents, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING id::text`, [name, typeof body.description === "string" ? body.description.trim().slice(0,1000) : "", activation, shareBps, duration, attribution, hold, minimum]);
  await audit(session.user.id, "program_created", "affiliate_program", result.rows[0].id, body);
  return NextResponse.json({ ok: true, id: result.rows[0].id });
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
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    if (action === "affiliate_status") {
      const status = typeof body.status === "string" ? body.status : "";
      if (!affiliateStatuses.has(status)) throw new Error("INVALID");
      const code = normalizeAffiliateCode(body.code);
      if (["approved","active"].includes(status) && !isSafeAffiliateCode(code)) throw new Error("CODE");
      const result = await client.query(`UPDATE affiliate_profiles SET status=$2, affiliate_code=CASE WHEN $3='' THEN affiliate_code ELSE $3 END,
        program_id=COALESCE($4::uuid, program_id), approved_at=CASE WHEN $2 IN ('approved','active') THEN COALESCE(approved_at,now()) ELSE approved_at END,
        activated_at=CASE WHEN $2='active' THEN COALESCE(activated_at,now()) ELSE activated_at END, admin_notes=CASE WHEN $5='' THEN admin_notes ELSE $5 END
        WHERE id::text=$1`, [targetId,status,code,typeof body.programId === "string" ? body.programId : null,reason]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id, "affiliate_status_changed", "affiliate", targetId, { status, code, reason }, client);
    } else if (action === "affiliate_overrides") {
      const bonus = body.activationBonus === "" || body.activationBonus == null ? null : Math.round(Number(body.activationBonus) * 100);
      const share = body.revenueSharePercent === "" || body.revenueSharePercent == null ? null : Math.round(Number(body.revenueSharePercent) * 100);
      const duration = body.durationMonths === "" || body.durationMonths == null ? null : Number(body.durationMonths);
      const minimum = body.minimumPayout === "" || body.minimumPayout == null ? null : Math.round(Number(body.minimumPayout) * 100);
      if ([bonus,share,duration,minimum].some(value => value !== null && (!Number.isInteger(value) || value < 0)) || (share !== null && share > 10000)) throw new Error("INVALID");
      const result = await client.query(`UPDATE affiliate_profiles SET activation_bonus_override_cents=$2,
        revenue_share_override_basis_points=$3,revenue_share_duration_override_months=$4,minimum_payout_override_cents=$5,
        admin_notes=CASE WHEN $6='' THEN admin_notes ELSE $6 END WHERE id::text=$1`, [targetId,bonus,share,duration,minimum,reason]);
      if (!result.rowCount) throw new Error("NOT_FOUND");
      await audit(session.user.id, "affiliate_overrides_changed", "affiliate", targetId, { bonus, share, duration, minimum, reason }, client);
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
    } else if (action === "payout_create") {
      const affiliate = await client.query<{ minimum_cents: number; payment_status:string; tax_onboarding_status:string; stripe_account_id:string|null; stripe_payouts_enabled:boolean }>(`SELECT COALESCE(affiliate.minimum_payout_override_cents,program.minimum_payout_cents)::int AS minimum_cents,
        affiliate.payment_status,affiliate.tax_onboarding_status,affiliate.stripe_account_id,affiliate.stripe_payouts_enabled
        FROM affiliate_profiles affiliate JOIN affiliate_programs program ON program.id=affiliate.program_id WHERE affiliate.id::text=$1 FOR UPDATE`, [targetId]);
      if (!affiliate.rows[0]) throw new Error("NOT_FOUND");
      if (!affiliate.rows[0].stripe_account_id||!affiliate.rows[0].stripe_payouts_enabled||affiliate.rows[0].payment_status!=="ready"||affiliate.rows[0].tax_onboarding_status!=="complete") throw new Error("NOT_READY");
      const payable = await client.query<{ id: string; amount_cents: number }>(`SELECT id::text, amount_cents FROM affiliate_commissions WHERE affiliate_id::text=$1 AND status='payable' ORDER BY created_at FOR UPDATE`, [targetId]);
      const total = payable.rows.reduce((sum,row)=>sum+row.amount_cents,0);
      if (total < affiliate.rows[0].minimum_cents) throw new Error("MINIMUM");
      const payout = await client.query<{ id: string }>(`INSERT INTO affiliate_payouts (affiliate_id,amount_cents,initiated_by,payout_method) VALUES ($1,$2,$3,'stripe_connect') RETURNING id::text`, [targetId,total,session.user.id]);
      for (const commission of payable.rows) await client.query(`INSERT INTO affiliate_payout_commissions (payout_id,commission_id,amount_cents) VALUES ($1,$2,$3)`, [payout.rows[0].id,commission.id,commission.amount_cents]);
      await client.query(`UPDATE affiliate_commissions SET status='approved' WHERE id=ANY($1::uuid[])`, [payable.rows.map(row=>row.id)]);
      await audit(session.user.id, "payout_created", "affiliate_payout", payout.rows[0].id, { affiliateId: targetId, total, commissionCount: payable.rowCount }, client);
    } else throw new Error("INVALID");
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "";
    if (message === "CODE") return NextResponse.json({ error: "Use a unique code with 3–32 letters, numbers, hyphens, or underscores." }, { status: 400 });
    if (message === "MINIMUM") return NextResponse.json({ error: "The payable balance has not reached this partner's minimum payout." }, { status: 409 });
    if (message === "NOT_READY") return NextResponse.json({ error: "Complete and verify this partner's payment and tax readiness before creating a payout." }, { status: 409 });
    if (message === "NOT_FOUND") return NextResponse.json({ error: "That record is not available for this action." }, { status: 404 });
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "That affiliate code is already in use." }, { status: 409 });
    return NextResponse.json({ error: message === "INVALID" ? "Check the requested action and required reason." : "The affiliate action could not be completed." }, { status: 400 });
  } finally { client.release(); }
}

async function audit(actor: string, action: string, targetType: string, targetId: string, details: unknown, client: { query: typeof database.query } = database) {
  await client.query(`INSERT INTO affiliate_audit_log (actor_user_id,action,target_type,target_id,details) VALUES ($1,$2,$3,$4,$5::jsonb)`, [actor,action,targetType,targetId,JSON.stringify(details)]);
}
