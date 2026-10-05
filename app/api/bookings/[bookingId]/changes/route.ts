import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { checkAndRecordContent } from "@/lib/content-safety";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { unavailableBookingProfessionals } from "@/lib/booking-staff";
import { calculateBookingFinancialSnapshot, type BookingFinancialPlan } from "@/lib/booking-financials";
import { calculateHourlyBasePriceCents, validateHourlyDuration, type HourlyPricingConfig } from "@/lib/service-pricing";

type BookingForChange = {
  id: string; customer_id: string; provider_user_id: string; provider_id: string; service_id: string; service_title: string;
  starts_at: Date; ends_at: Date; status: string; payment_status: string; pricing_type_snapshot: "FIXED" | "HOURLY";
  hourly_rate_cents_snapshot: number | null; billable_duration_minutes: number; billing_increment_minutes_snapshot: 15 | 30 | 60 | null;
  minimum_duration_minutes_snapshot: number | null; maximum_duration_minutes_snapshot: number | null;
  add_on_total_cents: number; discount_cents: number; provider_plan_snapshot: BookingFinancialPlan;
};

async function bookingForChange(bookingId: string, userId: string, lock = false) {
  const result = await database.query<BookingForChange>(
    `SELECT b.id::text,b.customer_id,p.user_id AS provider_user_id,b.provider_id::text,b.service_id::text,s.title AS service_title,
            b.starts_at,b.ends_at,b.status,b.payment_status,b.pricing_type_snapshot,b.hourly_rate_cents_snapshot,b.billable_duration_minutes,
            b.billing_increment_minutes_snapshot,b.minimum_duration_minutes_snapshot,b.maximum_duration_minutes_snapshot,
            b.add_on_total_cents,b.discount_cents,b.provider_plan_snapshot
     FROM bookings b JOIN provider_profiles p ON p.id=b.provider_id JOIN services s ON s.id=b.service_id
     WHERE b.id::text=$1 AND (b.customer_id=$2 OR p.user_id=$2) ${lock ? "FOR UPDATE OF b" : ""}`,
    [bookingId, userId],
  );
  return result.rows[0] ?? null;
}

export async function GET(_request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const booking = await bookingForChange(bookingId, session.user.id);
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const result = await database.query(
    `SELECT id::text,change_type,status,original_duration_minutes,requested_duration_minutes,
            original_service_subtotal_cents,requested_service_subtotal_cents,reason,requested_by,responded_by,responded_at,created_at
     FROM booking_change_requests WHERE booking_id::text=$1 ORDER BY created_at DESC`, [bookingId],
  );
  return NextResponse.json({ changes: result.rows });
}

export async function POST(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "booking-duration-change", limit: 10 })) return NextResponse.json({ error: "Too many booking changes. Please wait and try again." }, { status: 429 });
  const { bookingId } = await context.params;
  const body = await request.json() as { durationMinutes?: unknown; reason?: unknown };
  const durationMinutes = Number(body.durationMinutes);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: "Explain why the booked duration should change." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: session.user.id, surface: "booking_reschedule", fields: [reason] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<BookingForChange>(
      `SELECT b.id::text,b.customer_id,p.user_id AS provider_user_id,b.provider_id::text,b.service_id::text,s.title AS service_title,
              b.starts_at,b.ends_at,b.status,b.payment_status,b.pricing_type_snapshot,b.hourly_rate_cents_snapshot,b.billable_duration_minutes,
              b.billing_increment_minutes_snapshot,b.minimum_duration_minutes_snapshot,b.maximum_duration_minutes_snapshot,
              b.add_on_total_cents,b.discount_cents,b.provider_plan_snapshot
       FROM bookings b JOIN provider_profiles p ON p.id=b.provider_id JOIN services s ON s.id=b.service_id
       WHERE b.id::text=$1 AND (b.customer_id=$2 OR p.user_id=$2) FOR UPDATE OF b`, [bookingId, session.user.id],
    );
    const booking = result.rows[0];
    if (!booking) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Booking not found." }, { status: 404 }); }
    if (booking.pricing_type_snapshot !== "HOURLY" || booking.hourly_rate_cents_snapshot === null) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Duration changes are available only for hourly bookings." }, { status: 409 }); }
    if (!['requested','confirmed'].includes(booking.status)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 409 }); }
    if (booking.payment_status !== "unpaid") { await client.query("ROLLBACK"); return NextResponse.json({ error: "A paid booking cannot be repriced here. Request a partial refund or contact support so no additional charge occurs without customer authorization." }, { status: 409 }); }
    try {
      validateHourlyDuration({ pricingType: "HOURLY", hourlyRateCents: booking.hourly_rate_cents_snapshot,
        minimumDurationMinutes: booking.minimum_duration_minutes_snapshot!, maximumDurationMinutes: booking.maximum_duration_minutes_snapshot,
        billingIncrementMinutes: booking.billing_increment_minutes_snapshot!, defaultDurationMinutes: booking.billable_duration_minutes } satisfies HourlyPricingConfig, durationMinutes);
    } catch (error) { await client.query("ROLLBACK"); return NextResponse.json({ error: error instanceof Error ? error.message : "Choose a valid duration." }, { status: 400 }); }
    if (durationMinutes === booking.billable_duration_minutes) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Choose a different duration." }, { status: 400 }); }
    const originalLabor = calculateHourlyBasePriceCents(booking.hourly_rate_cents_snapshot, booking.billable_duration_minutes);
    const requestedLabor = calculateHourlyBasePriceCents(booking.hourly_rate_cents_snapshot, durationMinutes);
    const originalSubtotal = Math.max(50, originalLabor + booking.add_on_total_cents - booking.discount_cents);
    const requestedSubtotal = Math.max(50, requestedLabor + booking.add_on_total_cents - booking.discount_cents);
    const created = await client.query<{ id: string }>(
      `INSERT INTO booking_change_requests (booking_id,requested_by,change_type,original_duration_minutes,requested_duration_minutes,
         original_service_subtotal_cents,requested_service_subtotal_cents,reason)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
      [bookingId, session.user.id, durationMinutes > booking.billable_duration_minutes ? "duration_increase" : "duration_decrease",
        booking.billable_duration_minutes, durationMinutes, originalSubtotal, requestedSubtotal, reason],
    );
    const recipient = session.user.id === booking.customer_id ? booking.provider_user_id : booking.customer_id;
    await client.query(`INSERT INTO notifications (user_id,booking_id,type,title,message,href,dedupe_key)
      VALUES ($1,$2::uuid,'booking_change','Duration change requested',$3,'/account/bookings/'||$2::uuid::text,$4)`,
      [recipient, bookingId, `${booking.service_title}: review the requested change from ${booking.billable_duration_minutes} to ${durationMinutes} minutes.`, `booking-change-${created.rows[0].id}`]);
    await client.query(`INSERT INTO booking_events (booking_id,actor_user_id,event_type,message,metadata)
      VALUES ($1::uuid,$2,'duration_change_requested',$3,jsonb_build_object('changeId',$4::text,'durationMinutes',$5::integer,'subtotalCents',$6::integer))`,
      [bookingId, session.user.id, `Duration change requested: ${reason}`, created.rows[0].id, durationMinutes, requestedSubtotal]);
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: "duration_change_requested", targetType: "booking", targetId: bookingId });
    return NextResponse.json({ id: created.rows[0].id }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This booking already has a pending duration change." }, { status: 409 });
    console.error("Booking duration change failed", error);
    return NextResponse.json({ error: "We could not request this duration change." }, { status: 500 });
  } finally { client.release(); }
}

export async function PATCH(request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = await request.json() as { changeId?: unknown; action?: unknown };
  const changeId = typeof body.changeId === "string" ? body.changeId : "";
  const action = body.action === "approve" ? "approve" : body.action === "decline" ? "decline" : "";
  if (!changeId || !action) return NextResponse.json({ error: "Choose approve or decline." }, { status: 400 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<BookingForChange & { change_id: string; requested_by: string; requested_duration_minutes: number; requested_service_subtotal_cents: number }>(
      `SELECT b.id::text,b.customer_id,p.user_id AS provider_user_id,b.provider_id::text,b.service_id::text,s.title AS service_title,
              b.starts_at,b.ends_at,b.status,b.payment_status,b.pricing_type_snapshot,b.hourly_rate_cents_snapshot,b.billable_duration_minutes,
              b.billing_increment_minutes_snapshot,b.minimum_duration_minutes_snapshot,b.maximum_duration_minutes_snapshot,
              b.add_on_total_cents,b.discount_cents,b.provider_plan_snapshot,change.id::text AS change_id,change.requested_by,
              change.requested_duration_minutes,change.requested_service_subtotal_cents
       FROM booking_change_requests change JOIN bookings b ON b.id=change.booking_id
       JOIN provider_profiles p ON p.id=b.provider_id JOIN services s ON s.id=b.service_id
       WHERE change.id::text=$1 AND b.id::text=$2 AND change.status='pending'
         AND (b.customer_id=$3 OR p.user_id=$3) FOR UPDATE OF change,b`, [changeId, bookingId, session.user.id],
    );
    const change = result.rows[0];
    if (!change) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Pending change not found." }, { status: 404 }); }
    if (change.requested_by === session.user.id) { await client.query("ROLLBACK"); return NextResponse.json({ error: "The other party must approve this change." }, { status: 403 }); }
    if (change.payment_status !== "unpaid" || !['requested','confirmed'].includes(change.status)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This booking can no longer be repriced." }, { status: 409 }); }
    if (action === "approve") {
      const currentScheduledMinutes = Math.max(change.billable_duration_minutes, Math.round((change.ends_at.getTime() - change.starts_at.getTime()) / 60_000));
      const addOnMinutes = currentScheduledMinutes - change.billable_duration_minutes;
      const endsAt = new Date(change.starts_at.getTime() + (change.requested_duration_minutes + addOnMinutes) * 60_000);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [change.provider_id]);
      const unavailable = await unavailableBookingProfessionals(client, { bookingId, providerId: change.provider_id, serviceId: change.service_id, startsAt: change.starts_at, endsAt });
      if (unavailable.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "The requested duration no longer fits the provider's availability." }, { status: 409 }); }
      const snapshot = calculateBookingFinancialSnapshot(change.requested_service_subtotal_cents, change.provider_plan_snapshot);
      const basePrice = calculateHourlyBasePriceCents(change.hourly_rate_cents_snapshot!, change.requested_duration_minutes);
      await client.query(`UPDATE bookings SET ends_at=$2,billable_duration_minutes=$3,base_price_cents=$4,price_cents=$5,
        provider_fee_basis_points=$6,platform_fee_cents=$7,provider_payout_cents=$8,customer_service_fee_cents=$9,customer_total_cents=$10
        WHERE id::text=$1`, [bookingId, endsAt, change.requested_duration_minutes, basePrice, change.requested_service_subtotal_cents,
        snapshot.providerFeeBasisPoints,snapshot.providerFeeCents,snapshot.providerNetCents,snapshot.customerServiceFeeCents,snapshot.customerTotalCents]);
    }
    await client.query(`UPDATE booking_change_requests SET status=$2,responded_by=$3,responded_at=now() WHERE id::text=$1`, [changeId, action === "approve" ? "approved" : "declined", session.user.id]);
    await client.query(`INSERT INTO booking_events (booking_id,actor_user_id,event_type,message,metadata)
      VALUES ($1::uuid,$2,$3,$4,jsonb_build_object('changeId',$5::text,'durationMinutes',$6::integer,'subtotalCents',$7::integer))`,
      [bookingId, session.user.id, action === "approve" ? "duration_change_approved" : "duration_change_declined",
        action === "approve" ? "The requested duration and price were approved." : "The requested duration change was declined.", changeId, change.requested_duration_minutes, change.requested_service_subtotal_cents]);
    await client.query("COMMIT");
    await recordActivity({ userId: session.user.id, action: `duration_change_${action}d`, targetType: "booking", targetId: bookingId });
    return NextResponse.json({ ok: true });
  } catch (error) { await client.query("ROLLBACK"); console.error("Booking duration response failed", error); return NextResponse.json({ error: "We could not update this duration change." }, { status: 500 }); }
  finally { client.release(); }
}
