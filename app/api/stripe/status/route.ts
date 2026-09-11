import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode, stripeConfiguration } from "@/lib/stripe";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{
    stripe_customer_id: string | null; stripe_account_id: string | null;
    stripe_subscription_status: string; stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean; stripe_current_period_end: Date | null;
    stripe_connect_mode: "test" | "live" | null; stripe_billing_mode: "test" | "live" | null;
    extra_team_seats: number;
    pro_trial_used_at_test: Date | null; pro_trial_used_at_live: Date | null;
  }>(`SELECT stripe_customer_id, stripe_account_id, stripe_subscription_status,
      stripe_charges_enabled, stripe_payouts_enabled, stripe_current_period_end,
      stripe_connect_mode, stripe_billing_mode, extra_team_seats,
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
    extraTeamSeats: hasCurrentBilling ? provider.extra_team_seats : 0,
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
