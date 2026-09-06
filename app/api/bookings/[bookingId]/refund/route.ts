import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { hasAdminAccess } from "@/lib/admin";
import { recordAnalytics } from "@/lib/analytics";

type RefundAction = "request" | "approve" | "reject";

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Sign in to manage this refund." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "booking-refund", limit: 8 }))
    return NextResponse.json({ error: "Too many refund changes. Please wait and try again." }, { status: 429 });
  const { bookingId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown; amount?: unknown } | null;
  const action = body?.action as RefundAction;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!(["request", "approve", "reject"] as RefundAction[]).includes(action)) return NextResponse.json({ error: "Choose a valid refund action." }, { status: 400 });
  if ((action === "request" || action === "reject") && (reason.length < 3 || reason.length > 500)) return NextResponse.json({ error: "Add a brief reason." }, { status: 400 });
  if (reason) {
    const safety = await checkAndRecordContent({ userId: session.user.id, surface: "booking_refund", fields: [reason] });
    if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  }

  const result = await database.query<{
    id: string; customer_id: string; provider_user_id: string; provider_name: string; service_title: string;
    price_cents: number; payment_status: string; refund_status: string; stripe_payment_intent_id: string | null;
    stripe_mode: "test" | "live" | null; plan: ProviderPlan;
  }>(`SELECT b.id::text, b.customer_id, p.user_id AS provider_user_id, p.business_name AS provider_name,
      s.title AS service_title, b.price_cents, b.payment_status, b.refund_status,
      b.stripe_payment_intent_id, b.stripe_mode, p.plan
    FROM bookings b JOIN provider_profiles p ON p.id = b.provider_id JOIN services s ON s.id = b.service_id
    WHERE b.id::text = $1`, [bookingId]);
  const booking = result.rows[0];
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const isCustomer = booking.customer_id === session.user.id;
  const isProvider = booking.provider_user_id === session.user.id;
  const isAdmin = await hasAdminAccess(session.user.id, session.user.email);

  if (action === "request") {
    if (!isCustomer) return NextResponse.json({ error: "Only the customer can request a refund." }, { status: 403 });
    if (booking.payment_status !== "paid" || booking.stripe_mode !== getStripeMode()) return NextResponse.json({ error: "Only a completed Stripe payment can be refunded." }, { status: 409 });
    if (["requested", "processing", "refunded"].includes(booking.refund_status)) return NextResponse.json({ error: "A refund is already underway for this booking." }, { status: 409 });
    await database.query(`UPDATE bookings SET refund_status = 'requested', refund_requested_by = $2,
      refund_reason = $3, refund_requested_at = now(), refund_amount_cents = price_cents,
      refund_failure_reason = NULL WHERE id::text = $1`, [bookingId, session.user.id, reason]);
    await database.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message)
      VALUES ($1::uuid, $2, 'refund_requested', $3)`, [bookingId, session.user.id, `Customer requested a refund: ${reason}`]);
    await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
      VALUES ($1, $2::uuid, 'refund_requested', 'Refund requested', $3, '/provider/dashboard/bookings/' || $2::uuid::text,
      'refund-request-' || $2::uuid::text || '-' || extract(epoch from now())::bigint)`, [booking.provider_user_id, bookingId, `${session.user.name || "The customer"} requested a refund for ${booking.service_title}.`]);
    await recordActivity({ userId: session.user.id, action: "refund_requested", targetType: "booking", targetId: bookingId });
    await recordAnalytics({ eventName: "refund_requested", userId: session.user.id, targetType: "booking", targetId: bookingId });
    return NextResponse.json({ ok: true });
  }

  if (!isProvider && !isAdmin) return NextResponse.json({ error: "Only the provider or an administrator can decide this refund." }, { status: 403 });
  if (booking.refund_status !== "requested") return NextResponse.json({ error: "This refund is no longer awaiting a decision." }, { status: 409 });
  if (action === "reject") {
    await database.query("UPDATE bookings SET refund_status = 'rejected', refund_failure_reason = $2 WHERE id::text = $1 AND refund_status = 'requested'", [bookingId, reason]);
    await database.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message) VALUES ($1::uuid, $2, 'refund_rejected', $3)`, [bookingId, session.user.id, `Refund request declined: ${reason}`]);
    await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
      VALUES ($1, $2::uuid, 'refund_rejected', 'Refund update', $3, '/account/bookings/' || $2::uuid::text,
      'refund-rejected-' || $2::uuid::text || '-' || extract(epoch from now())::bigint)`, [booking.customer_id, bookingId, `${booking.provider_name} declined the refund request: ${reason}`]);
    await recordActivity({ userId: session.user.id, action: "refund_rejected", targetType: "booking", targetId: bookingId });
    return NextResponse.json({ ok: true });
  }

  if (!isStripeReady() || !booking.stripe_payment_intent_id || booking.stripe_mode !== getStripeMode()) return NextResponse.json({ error: "This Stripe payment cannot be refunded from the current environment." }, { status: 409 });
  const requestedDollars = Number(body?.amount);
  const amountCents = Number.isFinite(requestedDollars) ? Math.round(requestedDollars * 100) : booking.price_cents;
  if (amountCents < 1 || amountCents > booking.price_cents) return NextResponse.json({ error: `Choose an amount from $0.01 to $${(booking.price_cents / 100).toFixed(2)}.` }, { status: 400 });
  const claimed = await database.query("UPDATE bookings SET refund_status = 'processing', refund_amount_cents = $2, refund_failure_reason = NULL WHERE id::text = $1 AND refund_status = 'requested' RETURNING id", [bookingId, amountCents]);
  if (!claimed.rowCount) return NextResponse.json({ error: "This refund is already being processed." }, { status: 409 });

  try {
    const hasApplicationFee = PLAN_ENTITLEMENTS[booking.plan].bookingFeePercent > 0;
    const refund = await getStripe().refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: amountCents,
      reverse_transfer: true,
      ...(hasApplicationFee ? { refund_application_fee: true } : {}),
      metadata: { bookingId, approvedBy: session.user.id },
    }, { idempotencyKey: `booking-refund-${bookingId}-${amountCents}` });
    const fullyRefunded = amountCents >= booking.price_cents;
    await database.query(`UPDATE bookings SET refund_status = 'refunded', stripe_refund_id = $2,
      refunded_amount_cents = $3, refunded_at = now(), payment_status = CASE WHEN $4 THEN 'refunded' ELSE payment_status END
      WHERE id::text = $1`, [bookingId, refund.id, amountCents, fullyRefunded]);
    await database.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message, metadata)
      VALUES ($1::uuid, $2, 'refunded', $3, jsonb_build_object('amountCents', $4, 'stripeRefundId', $5))`, [bookingId, session.user.id, `$${(amountCents / 100).toFixed(2)} refund approved through Stripe.`, amountCents, refund.id]);
    await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
      VALUES ($1, $2::uuid, 'refund_approved', 'Refund approved', $3, '/account/bookings/' || $2::uuid::text,
      'refund-approved-' || $2::uuid::text || '-' || extract(epoch from now())::bigint)`, [booking.customer_id, bookingId, `${booking.provider_name} approved a $${(amountCents / 100).toFixed(2)} refund. Stripe will return it to the original payment method.`]);
    await recordActivity({ userId: session.user.id, action: "refund_approved", targetType: "booking", targetId: bookingId, metadata: { amountCents } });
    await recordAnalytics({ eventName: "refund_completed", userId: session.user.id, targetType: "booking", targetId: bookingId, metadata: { amountCents } });
    return NextResponse.json({ ok: true, amount: amountCents / 100 });
  } catch (error) {
    console.error("Stripe refund failed", error);
    await database.query("UPDATE bookings SET refund_status = 'failed', refund_failure_reason = 'Stripe could not complete this refund. Try again or contact support.' WHERE id::text = $1", [bookingId]);
    return NextResponse.json({ error: "Stripe could not complete this refund. No refund was issued." }, { status: 502 });
  }
}
