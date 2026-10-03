import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode, stripeConfiguration } from "@/lib/stripe";
import { extraSeatQuantity } from "@/lib/stripe-team-seats";
import { subscriptionProvidesProAccess } from "@/lib/team-seat-rules";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{
    stripe_customer_id: string | null; stripe_account_id: string | null; stripe_subscription_id: string | null;
    stripe_subscription_status: string; stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean; stripe_current_period_end: Date | null;
    stripe_connect_mode: "test" | "live" | null; stripe_billing_mode: "test" | "live" | null;
    extra_team_seats: number; reserved_worker_count: number;
    pro_trial_used_at_test: Date | null; pro_trial_used_at_live: Date | null;
  }>(`SELECT stripe_customer_id, stripe_account_id, stripe_subscription_id, stripe_subscription_status,
      stripe_charges_enabled, stripe_payouts_enabled, stripe_current_period_end,
      stripe_connect_mode, stripe_billing_mode, extra_team_seats,
      (SELECT count(DISTINCT lower(member.email))::int FROM provider_team_members member
       WHERE member.provider_id = provider_profiles.id AND member.status IN ('pending', 'active')) AS reserved_worker_count,
      pro_trial_used_at_test, pro_trial_used_at_live
    FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const configuration = stripeConfiguration();
  const mode = getStripeMode();
  const hasCurrentConnect = provider.stripe_connect_mode === mode && Boolean(provider.stripe_account_id);
  const hasCurrentBilling = provider.stripe_billing_mode === mode && Boolean(provider.stripe_customer_id);
  let payoutState: "not_started" | "in_review" | "action_needed" | "ready" = hasCurrentConnect ? "in_review" : "not_started";
  let requirements: string[] = [];
  let disabledReason: string | null = null;
  let taxReportingStatus: string | null = null;
  let cancelAtPeriodEnd = false;
  if (configuration.secretKey && hasCurrentBilling && provider.stripe_subscription_id) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(provider.stripe_subscription_id);
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
      const periodEnd = subscription.status === "trialing"
        ? subscription.trial_end
        : subscription.items.data[0]?.current_period_end ?? null;
      provider.stripe_subscription_status = subscription.status;
      provider.stripe_current_period_end = periodEnd ? new Date(periodEnd * 1000) : null;
      const stripeTeamSeats = extraSeatQuantity(subscription);
      const teamSeats = subscriptionProvidesProAccess(subscription.status) ? stripeTeamSeats : { itemId: null, quantity: 0 };
      provider.extra_team_seats = teamSeats.quantity;
      await database.query(`UPDATE provider_profiles SET stripe_subscription_status = $2,
        stripe_current_period_end = CASE WHEN $3::bigint IS NULL THEN NULL ELSE to_timestamp($3) END,
        extra_team_seats = $5, stripe_team_seat_item_id = $6
        WHERE stripe_subscription_id = $1 AND stripe_billing_mode = $4`,
      [subscription.id, subscription.status, periodEnd, mode, teamSeats.quantity, teamSeats.itemId]);
    } catch (error) {
      console.error("Stripe subscription status refresh failed", error);
    }
  }
  if (configuration.secretKey && hasCurrentConnect && provider.stripe_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(provider.stripe_account_id);
      provider.stripe_charges_enabled = account.charges_enabled;
      provider.stripe_payouts_enabled = account.payouts_enabled;
      requirements = [...new Set([...(account.requirements?.past_due ?? []), ...(account.requirements?.currently_due ?? [])])];
      disabledReason = account.requirements?.disabled_reason ?? null;
      taxReportingStatus = account.capabilities?.tax_reporting_us_1099_k ?? null;
      payoutState = account.charges_enabled && account.payouts_enabled ? "ready" : requirements.length || disabledReason ? "action_needed" : "in_review";
      await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1 AND stripe_connect_mode = $4", [provider.stripe_account_id, account.charges_enabled, account.payouts_enabled, mode]);
    } catch (error) {
      console.error("Stripe Connect status refresh failed", error);
    }
  }
  return NextResponse.json({
    configured: Object.values(configuration).every(Boolean),
    missingConfiguration: Object.entries(configuration).filter(([, present]) => !present).map(([name]) => name),
    mode,
    hasCustomer: hasCurrentBilling,
    subscriptionStatus: hasCurrentBilling ? provider.stripe_subscription_status : "inactive",
    currentPeriodEnd: hasCurrentBilling ? provider.stripe_current_period_end : null,
    cancelAtPeriodEnd: hasCurrentBilling && cancelAtPeriodEnd,
    extraTeamSeats: hasCurrentBilling ? provider.extra_team_seats : 0,
    seatsUsed: provider.reserved_worker_count + 1,
    trialEligible: mode === "live" ? !provider.pro_trial_used_at_live : !provider.pro_trial_used_at_test,
    connect: {
      started: hasCurrentConnect,
      chargesEnabled: hasCurrentConnect && provider.stripe_charges_enabled,
      payoutsEnabled: hasCurrentConnect && provider.stripe_payouts_enabled,
      state: payoutState,
      requirements,
      disabledReason,
      taxReportingStatus,
    },
  });
}
