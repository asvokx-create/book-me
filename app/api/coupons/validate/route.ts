import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_CUSTOMER_SERVICE_FEE_CENTS } from "@/lib/booking-financials";
import { database } from "@/lib/database";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { enforceRateLimit } from "@/lib/request-security";
import { calculateCommerceSelection, type CouponRule, type ServiceAddOn, type ServicePackage } from "@/lib/service-commerce";
import { calculateHourlyBasePriceCents, validateHourlyDuration, type HourlyPricingConfig, type PricingType } from "@/lib/service-pricing";

type CouponRequest = {
  serviceId?: unknown;
  packageId?: unknown;
  addOns?: unknown;
  couponCode?: unknown;
  durationMinutes?: unknown;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to apply a coupon." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "coupon-validate", limit: 30 })) {
    return NextResponse.json({ error: "Too many coupon checks. Please wait a minute and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as CouponRequest | null;
  const serviceId = typeof body?.serviceId === "string" ? body.serviceId : "";
  const packageId = typeof body?.packageId === "string" ? body.packageId : "";
  const couponCode = typeof body?.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
  const requestedDurationMinutes = Number(body?.durationMinutes);
  const requestedAddOns = Array.isArray(body?.addOns)
    ? body.addOns.slice(0, 10).map((entry) => entry && typeof entry === "object" ? entry as Record<string, unknown> : {})
      .map((entry) => ({ addOnId: typeof entry.addOnId === "string" ? entry.addOnId : "", quantity: Number(entry.quantity) }))
    : [];
  if (!serviceId || !/^[A-Z0-9_-]{3,32}$/.test(couponCode)) return NextResponse.json({ error: "Enter a valid coupon code." }, { status: 400 });

  const serviceResult = await database.query<{ price_cents: number; provider_id: string; plan: ProviderPlan; pricing_type: PricingType; hourly_rate_cents: number | null; minimum_duration_minutes: number | null; maximum_duration_minutes: number | null; billing_increment_minutes: 15 | 30 | 60 | null; default_duration_minutes: number | null }>(
    `SELECT s.price_cents,s.pricing_type,s.hourly_rate_cents,s.minimum_duration_minutes,s.maximum_duration_minutes,s.billing_increment_minutes,s.default_duration_minutes,s.provider_id::text,p.plan FROM services s
     JOIN provider_profiles p ON p.id=s.provider_id AND p.is_active=true
     WHERE s.id::text=$1 AND s.is_active=true LIMIT 1`,
    [serviceId],
  );
  const service = serviceResult.rows[0];
  if (!service) return NextResponse.json({ error: "This service is no longer available." }, { status: 404 });
  if (!PLAN_ENTITLEMENTS[service.plan].promotions) return NextResponse.json({ error: "That coupon is not valid for this service." }, { status: 400 });

  const selectedPackageResult = packageId
    ? await database.query<ServicePackage>(`SELECT id::text,name,description,price_cents AS "priceCents",duration_minutes AS "durationMinutes",delivery_days AS "deliveryDays",revision_count AS "revisionCount",features FROM service_packages WHERE id::text=$1 AND service_id::text=$2 AND is_active=true`, [packageId, serviceId])
    : null;
  const selectedPackage = selectedPackageResult?.rows[0] ?? null;
  if (packageId && !selectedPackage) return NextResponse.json({ error: "That package is no longer available." }, { status: 409 });
  if (service.pricing_type === "HOURLY" && selectedPackage) return NextResponse.json({ error: "Packages cannot be combined with hourly pricing." }, { status: 400 });

  const addOnIds = requestedAddOns.map((item) => item.addOnId).filter(Boolean);
  const addOnResult = addOnIds.length
    ? await database.query<ServiceAddOn>(`SELECT id::text,name,description,price_cents AS "priceCents",additional_minutes AS "additionalMinutes",allows_quantity AS "allowsQuantity",max_quantity AS "maxQuantity" FROM service_add_ons WHERE service_id::text=$1 AND id::text=ANY($2::text[]) AND is_active=true`, [serviceId, addOnIds])
    : { rows: [] as ServiceAddOn[] };
  if (new Set(addOnIds).size !== addOnIds.length || addOnResult.rows.length !== addOnIds.length) return NextResponse.json({ error: "One of those add-ons is no longer available." }, { status: 409 });
  const addOnById = new Map(addOnResult.rows.map((item) => [item.id, item]));

  const couponResult = await database.query<CouponRule>(
    `SELECT id::text,code,discount_type AS "discountType",discount_value AS "discountValue",minimum_subtotal_cents AS "minimumSubtotalCents",first_booking_only AS "firstBookingOnly",repeat_customer_only AS "repeatCustomerOnly",expires_at AS "expiresAt",usage_limit AS "usageLimit",redemption_count AS "redemptionCount"
     FROM provider_coupons WHERE provider_id::text=$1 AND upper(code)=$2 AND is_active=true AND (service_id IS NULL OR service_id::text=$3)`,
    [service.provider_id, couponCode, serviceId],
  );
  const coupon = couponResult.rows[0];
  if (!coupon) return NextResponse.json({ error: "That coupon is not valid for this service." }, { status: 400 });
  const priorCount = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM bookings WHERE customer_id=$1 AND provider_id::text=$2 AND payment_status IN ('paid','refunded')", [session.user.id, service.provider_id]);
  if (coupon.firstBookingOnly && priorCount.rows[0].count > 0) return NextResponse.json({ error: "That coupon is for first-time customers." }, { status: 400 });
  if (coupon.repeatCustomerOnly && priorCount.rows[0].count < 1) return NextResponse.json({ error: "That coupon is for returning customers." }, { status: 400 });

  try {
    let servicePriceCents = service.price_cents;
    if (service.pricing_type === "HOURLY") {
      const config: HourlyPricingConfig = { pricingType: "HOURLY", hourlyRateCents: service.hourly_rate_cents!, minimumDurationMinutes: service.minimum_duration_minutes!, maximumDurationMinutes: service.maximum_duration_minutes, billingIncrementMinutes: service.billing_increment_minutes!, defaultDurationMinutes: service.default_duration_minutes! };
      servicePriceCents = calculateHourlyBasePriceCents(config.hourlyRateCents, validateHourlyDuration(config, requestedDurationMinutes));
    }
    const commerce = calculateCommerceSelection({
      servicePriceCents,
      selectedPackage,
      addOns: requestedAddOns.map((item) => ({ addOn: addOnById.get(item.addOnId)!, quantity: item.quantity })),
      coupon,
    });
    if (commerce.serviceSubtotalCents < 50) return NextResponse.json({ error: "The discounted booking total must be at least $0.50." }, { status: 400 });
    return NextResponse.json({
      code: coupon.code,
      originalSubtotalCents: commerce.originalSubtotalCents,
      discountCents: commerce.discountCents,
      serviceSubtotalCents: commerce.serviceSubtotalCents,
      customerServiceFeeCents: DEFAULT_CUSTOMER_SERVICE_FEE_CENTS,
      customerTotalCents: commerce.serviceSubtotalCents + DEFAULT_CUSTOMER_SERVICE_FEE_CENTS,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "That coupon could not be applied." }, { status: 400 });
  }
}
