import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode, isStripeReady } from "@/lib/stripe";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { sendTransactionalEmail } from "@/lib/email";
import { applyCancellationSetting, canScheduleSubscriptionCancellation } from "@/lib/subscription-lifecycle";

export async function POST(request: Request) {
  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to manage your provider plan." }, { status: 401 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-subscription-manage", limit: 8 })) {
      return NextResponse.json({ error: "Too many plan changes. Please wait and try again." }, { status: 429 });
    }
    if (!isStripeReady()) return NextResponse.json({ error: "Stripe billing is temporarily unavailable." }, { status: 503 });

    const body = await request.json().catch(() => null) as { action?: unknown; operationId?: unknown } | null;
    const action = body?.action;
    const operationId = typeof body?.operationId === "string" && /^[0-9a-f-]{36}$/i.test(body.operationId) ? body.operationId : "";
    if (action !== "cancel" && action !== "resume") {
      return NextResponse.json({ error: "Choose a valid subscription action." }, { status: 400 });
    }
    if (!operationId) return NextResponse.json({ error: "Subscription request is invalid. Refresh and try again." }, { status: 400 });

    const result = await database.query<{
      id: string;
      stripe_subscription_id: string | null;
      stripe_billing_mode: "test" | "live" | null;
      plan: string;
      email: string;
    }>(`SELECT provider.id::text, provider.stripe_subscription_id, provider.stripe_billing_mode,
        provider.plan, account.email
        FROM provider_profiles provider JOIN "user" account ON account.id = provider.user_id
        WHERE provider.user_id = $1 AND provider.is_active = true`, [session.user.id]);
    const provider = result.rows[0];
    if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
    if (provider.plan === "owner") return NextResponse.json({ error: "The Owner Plan has no subscription charge to cancel." }, { status: 409 });
    if (!provider.stripe_subscription_id || provider.stripe_billing_mode !== getStripeMode()) {
      return NextResponse.json({ error: "No current subscription was found." }, { status: 404 });
    }

    const stripe = getStripe();
    const existing = await stripe.subscriptions.retrieve(provider.stripe_subscription_id);
    if (existing.metadata.providerId !== provider.id || existing.metadata.plan !== "pro") {
      return NextResponse.json({ error: "This subscription could not be verified for your provider account." }, { status: 403 });
    }
    if (!canScheduleSubscriptionCancellation(existing.status)) {
      return NextResponse.json({ error: "This subscription is no longer active." }, { status: 409 });
    }
    const change = await applyCancellationSetting({
      subscription: existing,
      action,
      operationId,
      update: (id, cancelAtPeriodEnd, idempotencyKey) => stripe.subscriptions.update(
        id,
        { cancel_at_period_end: cancelAtPeriodEnd },
        { idempotencyKey },
      ),
    });
    const { subscription, stateChanged, cancelAtPeriodEnd, periodEnd } = change;
    const periodEndIso = new Date(periodEnd * 1000).toISOString();
    const periodEndLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "America/Los_Angeles" }).format(new Date(periodEnd * 1000));
    let localReconciled = true;
    let inboxConfirmationCreated = false;
    let emailConfirmationSent = false;
    try {
      const reconciled = await database.query(`UPDATE provider_profiles SET stripe_subscription_status = $2,
          stripe_current_period_end = to_timestamp($3), stripe_cancel_at_period_end = $4
          WHERE id::text = $1 AND stripe_subscription_id = $5 AND stripe_billing_mode = $6
          RETURNING id`,
      [provider.id, subscription.status, periodEnd, subscription.cancel_at_period_end, subscription.id, getStripeMode()]);
      localReconciled = reconciled.rowCount === 1;
    } catch (error) {
      localReconciled = false;
      console.error("Stripe confirmed a subscription change but local reconciliation failed", error);
    }

    if (stateChanged) {
      const notification = cancelAtPeriodEnd
        ? { title: "Pro cancellation scheduled", message: `Your Pro subscription will not renew. Pro access continues through ${periodEndLabel}.`, key: `pro-cancel-scheduled-${subscription.id}-${operationId}` }
        : { title: "Pro cancellation reversed", message: `Your Pro subscription will continue and renew normally after ${periodEndLabel}.`, key: `pro-cancel-reversed-${subscription.id}-${operationId}` };
      try {
        await database.query(`INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
          VALUES ($1, 'billing', $2, $3, '/provider/dashboard/billing', $4)
          ON CONFLICT (dedupe_key) DO NOTHING`, [session.user.id, notification.title, notification.message, notification.key]);
        inboxConfirmationCreated = true;
      } catch (error) {
        console.error("Subscription confirmation notification failed", error);
      }
      const delivery = await sendTransactionalEmail({
        to: provider.email,
        userId: session.user.id,
        emailType: notification.key,
        idempotencyKey: notification.key,
        subject: cancelAtPeriodEnd ? "Your BubsBookings Pro cancellation is scheduled" : "Your BubsBookings Pro plan will continue",
        heading: notification.title,
        message: notification.message,
        actionLabel: "View billing",
        actionUrl: "/provider/dashboard/billing",
      });
      emailConfirmationSent = delivery.sent;
      await recordActivity({
        userId: session.user.id,
        action: cancelAtPeriodEnd ? "provider_subscription_cancellation_scheduled" : "provider_subscription_cancellation_reversed",
        targetType: "provider_subscription",
        targetId: subscription.id,
        metadata: { currentPeriodEnd: periodEndIso },
      });
    }

    return NextResponse.json({
      ok: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEndIso,
      localReconciled,
      inboxConfirmationCreated,
      emailConfirmationSent,
    });
  } catch (error) {
    console.error("Pro subscription change failed", error);
    return NextResponse.json({ error: "Stripe could not confirm the subscription update. Refresh Billing to verify your current renewal setting before trying again." }, { status: 502 });
  }
}
