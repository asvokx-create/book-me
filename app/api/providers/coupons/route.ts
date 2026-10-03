import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit } from "@/lib/request-security";

async function ownerAccess(request?: Request) {
  const access = await getProviderAccess();
  if (!access || !access.isOwner) return null;
  if (request && !await enforceRateLimit({ request, userId: access.session.user.id, bucket: "provider-coupon-change", limit: 20 })) return "limited" as const;
  return access;
}

export async function GET() {
  const access = await ownerAccess();
  if (!access || access === "limited") return NextResponse.json({ error: "Provider owner access is required." }, { status: 403 });
  const provider = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE id::text=$1", [access.providerId]);
  const coupons = await database.query(`SELECT coupon.id::text,coupon.service_id::text AS "serviceId",service.title AS "serviceTitle",coupon.code,coupon.discount_type AS "discountType",coupon.discount_value AS "discountValue",coupon.minimum_subtotal_cents AS "minimumSubtotalCents",coupon.first_booking_only AS "firstBookingOnly",coupon.repeat_customer_only AS "repeatCustomerOnly",coupon.expires_at AS "expiresAt",coupon.usage_limit AS "usageLimit",coupon.redemption_count AS "redemptionCount",coupon.is_active AS "isActive" FROM provider_coupons coupon LEFT JOIN services service ON service.id=coupon.service_id WHERE coupon.provider_id::text=$1 ORDER BY coupon.created_at DESC`, [access.providerId]);
  return NextResponse.json({ coupons: coupons.rows, allowed: PLAN_ENTITLEMENTS[provider.rows[0]?.plan ?? "starter"].promotions });
}

export async function POST(request: Request) {
  const access = await ownerAccess(request);
  if (!access) return NextResponse.json({ error: "Provider owner access is required." }, { status: 403 });
  if (access === "limited") return NextResponse.json({ error: "Too many promotion changes. Please wait a minute." }, { status: 429 });
  const provider = await database.query<{ plan: ProviderPlan }>("SELECT plan FROM provider_profiles WHERE id::text=$1", [access.providerId]);
  if (!PLAN_ENTITLEMENTS[provider.rows[0]?.plan ?? "starter"].promotions) return NextResponse.json({ error: "Provider coupons require Pro.", upgradeRequired: true }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountType = body.discountType === "fixed" ? "fixed" : "percentage";
  const discountValue = discountType === "fixed" ? Math.round(Number(body.discountValue) * 100) : Math.round(Number(body.discountValue));
  const minimumSubtotalCents = Math.round(Number(body.minimumSubtotal ?? 0) * 100);
  const serviceId = typeof body.serviceId === "string" && body.serviceId ? body.serviceId : null;
  const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? new Date(`${body.expiresAt}T23:59:59.999Z`) : null;
  const usageLimit = body.usageLimit === "" || body.usageLimit === null || body.usageLimit === undefined ? null : Number(body.usageLimit);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isSafeInteger(discountValue) || discountValue < 1 || discountType === "percentage" && discountValue > 100 || !Number.isSafeInteger(minimumSubtotalCents) || minimumSubtotalCents < 0 || expiresAt && Number.isNaN(expiresAt.getTime()) || usageLimit !== null && (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 100000)) return NextResponse.json({ error: "Enter valid coupon details." }, { status: 400 });
  if (serviceId) {
    const owns = await database.query("SELECT 1 FROM services WHERE id::text=$1 AND provider_id::text=$2 AND is_active=true", [serviceId,access.providerId]);
    if (!owns.rows[0]) return NextResponse.json({ error: "Choose one of your active services." }, { status: 400 });
  }
  try {
    const created = await database.query<{ id: string }>(`INSERT INTO provider_coupons (provider_id,service_id,code,discount_type,discount_value,minimum_subtotal_cents,first_booking_only,repeat_customer_only,expires_at,usage_limit) VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text`, [access.providerId,serviceId,code,discountType,discountValue,minimumSubtotalCents,body.firstBookingOnly===true,body.repeatCustomerOnly===true,expiresAt,usageLimit]);
    return NextResponse.json({ id: created.rows[0].id }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "You already use that coupon code." }, { status: 409 });
    console.error("Coupon creation failed", error);
    return NextResponse.json({ error: "We could not create this coupon." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const access = await ownerAccess(request);
  if (!access) return NextResponse.json({ error: "Provider owner access is required." }, { status: 403 });
  if (access === "limited") return NextResponse.json({ error: "Too many promotion changes. Please wait a minute." }, { status: 429 });
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const updated = await database.query(`UPDATE provider_coupons SET is_active=$3 WHERE id::text=$1 AND provider_id::text=$2 RETURNING id`, [id,access.providerId,body.isActive===true]);
  if (!updated.rowCount) return NextResponse.json({ error: "Coupon not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

