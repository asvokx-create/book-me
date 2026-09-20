import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { refundUnreleasedBooking, releaseBookingPayout } from "@/lib/payment-release";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";

const statuses = new Set(["reviewing", "resolved", "dismissed"]);

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const type = new URL(request.url).searchParams.get("type");
  if (type === "bugs") {
    const result = await database.query(
      `SELECT br.id::text, br.title, br.details, br.steps_to_reproduce, br.page_url,
              br.status, br.admin_note, br.created_at, u.name AS reporter_name, u.email AS reporter_email
       FROM bug_reports br JOIN "user" u ON u.id = br.reporter_id
       ORDER BY CASE br.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, br.created_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ issues: result.rows });
  }
  if (type === "disputes") {
    const result = await database.query(
      `SELECT d.id::text, d.category, d.details, d.requested_resolution, d.status,
              d.admin_note, d.resolution_outcome, d.resolved_at, d.created_at,
              s.title AS service_title, b.id::text AS booking_id,
              opener.name AS reporter_name, opener.email AS reporter_email,
              against_user.name AS against_name, against_user.email AS against_email
       FROM booking_disputes d
       JOIN bookings b ON b.id = d.booking_id
       JOIN services s ON s.id = b.service_id
       JOIN "user" opener ON opener.id = d.opened_by
       JOIN "user" against_user ON against_user.id = d.against_user_id
       ORDER BY CASE d.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, d.created_at DESC
       LIMIT 100`,
    );
    return NextResponse.json({ issues: result.rows });
  }
  return NextResponse.json({ error: "Choose bugs or disputes." }, { status: 400 });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-action", limit: 30 })) return NextResponse.json({ error: "Too many admin actions. Please wait a minute." }, { status: 429 });
  const body = (await request.json()) as Record<string, unknown>;
  const type = body.type === "bugs" || body.type === "disputes" ? body.type : "";
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const outcome = body.outcome === "provider" || body.outcome === "customer" || body.outcome === "partial" ? body.outcome : "";
  const partialAmountCents = Number.isFinite(Number(body.amount)) ? Math.round(Number(body.amount) * 100) : 0;
  if (!type || !id || !statuses.has(status)) return NextResponse.json({ error: "Choose a valid case update." }, { status: 400 });
  if (type === "disputes" && (status === "resolved" || status === "dismissed")) {
    if (status !== "resolved" || !outcome) return NextResponse.json({ error: "Choose whether the provider or customer won the dispute." }, { status: 400 });
    if (note.length < 3) return NextResponse.json({ error: "Add a short note explaining the decision." }, { status: 400 });
  }
  if (type === "bugs") {
    const result = await database.query("UPDATE bug_reports SET status = $2, admin_note = $3, updated_at = now() WHERE id::text = $1 RETURNING id", [id, status, note]);
    if (!result.rowCount) return NextResponse.json({ error: "That case was not found." }, { status: 404 });
    await database.query(
      `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, 'bug_report', $3, $4::jsonb)`,
      [session.user.id, `bugs_${status}`, id, JSON.stringify({ status, note })],
    );
    return NextResponse.json({ ok: true });
  }

  if (status === "reviewing") {
    const result = await database.query("UPDATE booking_disputes SET status = 'reviewing', admin_note = $2, updated_at = now() WHERE id::text = $1 AND status = 'open' RETURNING id", [id, note]);
    if (!result.rowCount) return NextResponse.json({ error: "That dispute is no longer open." }, { status: 409 });
    await database.query(
      `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, 'disputes_reviewing', 'booking_dispute', $2, $3::jsonb)`,
      [session.user.id, id, JSON.stringify({ status, note })],
    );
    return NextResponse.json({ ok: true });
  }

  const existing = await database.query<{ booking_id: string; status: "open" | "reviewing"; opened_by: string; against_user_id: string }>(
    "SELECT booking_id::text, status, opened_by, against_user_id FROM booking_disputes WHERE id::text = $1 AND status IN ('open', 'reviewing')",
    [id],
  );
  const dispute = existing.rows[0];
  if (!dispute) return NextResponse.json({ error: "That dispute has already been decided or was not found." }, { status: 409 });
  const claimed = await database.query<{ booking_id: string }>(`UPDATE booking_disputes
    SET status = 'resolved', admin_note = $3, resolution_outcome = $4, resolved_at = now(), resolved_by = $5, updated_at = now()
    WHERE id::text = $1 AND status = $2 RETURNING booking_id::text`,
    [id, dispute.status, note, outcome, session.user.id]);
  if (!claimed.rowCount) return NextResponse.json({ error: "Another administrator already decided this dispute." }, { status: 409 });

  const restoreDispute = async () => {
    await database.query(`UPDATE booking_disputes SET status = $2, resolution_outcome = NULL,
      resolved_at = NULL, resolved_by = NULL, updated_at = now()
      WHERE id::text = $1 AND status = 'resolved' AND resolution_outcome = $3`, [id, dispute.status, outcome]);
  };

  let financialResult: Record<string, unknown> = {};
  if (outcome === "partial") {
    if (!isStripeReady()) { await restoreDispute(); return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 }); }
    const payment = await database.query<{
      price_cents: number; refunded_amount_cents: number; platform_fee_cents: number; provider_payout_cents: number;
      stripe_payment_intent_id: string | null; stripe_transfer_id: string | null; stripe_transfer_reversed_cents: number;
      stripe_mode: "test" | "live" | null;
    }>(`SELECT price_cents, refunded_amount_cents, platform_fee_cents, provider_payout_cents,
        stripe_payment_intent_id, stripe_transfer_id, stripe_transfer_reversed_cents, stripe_mode
      FROM bookings WHERE id::text = $1`, [dispute.booking_id]);
    const booking = payment.rows[0];
    const remaining = booking ? booking.price_cents - booking.refunded_amount_cents : 0;
    if (!booking?.stripe_payment_intent_id || booking.stripe_mode !== getStripeMode() || partialAmountCents < 1 || partialAmountCents >= remaining) {
      await restoreDispute();
      return NextResponse.json({ error: `Enter a partial refund between $0.01 and $${Math.max(0, (remaining - 1) / 100).toFixed(2)}.` }, { status: 400 });
    }
    try {
      const totalRefunded = booking.refunded_amount_cents + partialAmountCents;
      const refund = await getStripe().refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: partialAmountCents,
        metadata: { bookingId: dispute.booking_id, kind: "dispute_partial_refund", disputeId: id },
      }, { idempotencyKey: `dispute-partial-refund-${id}-${totalRefunded}` });
      const originalProviderShare = booking.price_cents - booking.platform_fee_cents;
      const adjustedProviderShare = Math.max(0, Math.round(originalProviderShare * (booking.price_cents - totalRefunded) / booking.price_cents));
      let reversedCents = booking.stripe_transfer_reversed_cents;
      if (booking.stripe_transfer_id) {
        const targetReversal = Math.max(0, originalProviderShare - adjustedProviderShare);
        const reversalAmount = Math.max(0, targetReversal - reversedCents);
        if (reversalAmount > 0) {
          await getStripe().transfers.createReversal(booking.stripe_transfer_id, {
            amount: reversalAmount,
            metadata: { bookingId: dispute.booking_id, kind: "dispute_partial_reversal", disputeId: id, stripeRefundId: refund.id },
          }, { idempotencyKey: `dispute-partial-reversal-${id}-${targetReversal}` });
          reversedCents += reversalAmount;
        }
      }
      await database.query(`UPDATE bookings SET refund_status = 'refunded', stripe_refund_id = $2,
        refunded_amount_cents = $3, refunded_at = now(), provider_payout_cents = $4,
        stripe_transfer_reversed_cents = $5, payment_release_status = CASE
          WHEN stripe_transfer_id IS NOT NULL THEN 'partially_released'
          WHEN status = 'completed' THEN 'awaiting_customer' ELSE 'secured' END,
        payout_frozen_at = NULL, payout_frozen_by = NULL, payout_freeze_reason = NULL, payout_failure_reason = NULL
        WHERE id::text = $1`, [dispute.booking_id, refund.id, totalRefunded, adjustedProviderShare, reversedCents]);
      await database.query(`INSERT INTO booking_events (booking_id, actor_user_id, event_type, message, metadata)
        VALUES ($1::uuid, $2, 'refunded', $3, jsonb_build_object('amountCents', $4::integer, 'stripeRefundId', $5, 'disputeId', $6))`,
        [dispute.booking_id, session.user.id, `$${(partialAmountCents / 100).toFixed(2)} partial dispute refund issued through Stripe.`, partialAmountCents, refund.id, id]);
      financialResult = { partialRefunded: true, amountCents: partialAmountCents, providerShareCents: adjustedProviderShare };
    } catch (error) {
      console.error("Partial dispute resolution failed", error);
      await restoreDispute();
      return NextResponse.json({ error: "Stripe could not complete the partial refund and transfer adjustment. The dispute remains open." }, { status: 502 });
    }
  } else if (outcome === "customer") {
    const refund = await refundUnreleasedBooking(dispute.booking_id, `Dispute resolved in the customer's favor: ${note}`);
    if (!refund.ok) {
      await restoreDispute();
      return NextResponse.json({ error: refund.error }, { status: 502 });
    }
    if (!refund.refunded) {
      const payment = await database.query<{ payment_status: string }>("SELECT payment_status FROM bookings WHERE id::text = $1", [dispute.booking_id]);
      if (payment.rows[0]?.payment_status !== "refunded") {
        await restoreDispute();
        return NextResponse.json({ error: "This payment is no longer being held and could not be refunded automatically. Review it in Stripe before closing the dispute." }, { status: 409 });
      }
    }
    financialResult = { refunded: true };
  } else {
    await database.query(`UPDATE bookings b SET payout_frozen_at = NULL, payout_frozen_by = NULL, payout_freeze_reason = NULL,
      payment_release_status = CASE WHEN b.status = 'completed' THEN 'awaiting_customer' ELSE 'secured' END
      WHERE b.id::text = $1 AND b.payout_freeze_reason = 'Open booking dispute'
        AND b.payment_status = 'paid' AND b.payment_release_status = 'frozen'
        AND NOT EXISTS (SELECT 1 FROM booking_disputes d WHERE d.booking_id = b.id AND d.status IN ('open', 'reviewing'))`, [dispute.booking_id]);
    const release = await releaseBookingPayout(dispute.booking_id, "admin");
    const payoutState = await database.query<{
      status: string; payment_status: string; stripe_transfer_id: string | null; open_disputes: number;
    }>(`SELECT b.status, b.payment_status, b.stripe_transfer_id,
      (SELECT count(*)::int FROM booking_disputes d
       WHERE d.booking_id = b.id AND d.status IN ('open', 'reviewing')) AS open_disputes
      FROM bookings b WHERE b.id::text = $1`, [dispute.booking_id]);
    const payout = payoutState.rows[0];
    const payoutShouldHaveReleased = payout?.status === "completed"
      && payout.payment_status === "paid"
      && !payout.stripe_transfer_id
      && payout.open_disputes === 0;
    if (payoutShouldHaveReleased && (!release.ok || !release.released)) {
      await restoreDispute();
      await database.query(`UPDATE bookings SET payout_frozen_at = now(), payout_frozen_by = $2,
        payout_freeze_reason = 'Open booking dispute', payment_release_status = 'frozen'
        WHERE id::text = $1 AND payment_status = 'paid' AND stripe_transfer_id IS NULL
          AND payment_release_status IN ('secured', 'awaiting_customer', 'failed')`, [dispute.booking_id, session.user.id]);
      return NextResponse.json({ error: release.ok ? "The provider payout was not released, so the dispute remains under review." : release.error }, { status: 502 });
    }
    financialResult = release.ok ? { payoutReleased: release.released } : { payoutReleased: false, payoutMessage: release.error };
  }
  await database.query(
    `INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [session.user.id, "disputes_resolved", "booking_dispute", id, JSON.stringify({ status, note, outcome, ...financialResult })],
  );
  const decisionMessage = outcome === "provider"
    ? "The dispute was decided in the provider's favor. Any eligible held payout was released or returned to the normal payout queue."
    : outcome === "partial"
      ? `The dispute was resolved with a $${(partialAmountCents / 100).toFixed(2)} partial refund. The provider share was adjusted to match.`
      : "The dispute was decided in the customer's favor. The held payment was refunded.";
  await database.query(`INSERT INTO notifications (user_id, booking_id, type, title, message, href, dedupe_key)
    SELECT participant.user_id, $3::uuid, 'dispute_resolved', 'Dispute decision', $4, '/disputes',
      'dispute-resolution-' || $1 || '-' || participant.user_id
    FROM (VALUES ($2::text), ($5::text)) AS participant(user_id)
    ON CONFLICT (dedupe_key) DO NOTHING`, [id, dispute.opened_by, dispute.booking_id, decisionMessage, dispute.against_user_id]);
  return NextResponse.json({ ok: true, outcome, ...financialResult });
}
