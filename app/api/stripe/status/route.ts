import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode, stripeConfiguration } from "@/lib/stripe";
import { extraSeatQuantity } from "@/lib/stripe-team-seats";
import { subscriptionProvidesProAccess } from "@/lib/team-seat-rules";
import { resetMismatchedStripeAgeVerification, syncProviderAgeVerificationFromStripe } from "@/lib/provider-age-verification";
import { subscriptionPeriodEndUnix } from "@/lib/subscription-lifecycle";
import { getComplimentaryProStatus, reconcileExpiredComplimentaryProGrants } from "@/lib/complimentary-pro";
import { providerPayoutSetupState } from "@/lib/provider-payout-status";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{
    id: string;
    stripe_customer_id: string | null; stripe_account_id: string | null; stripe_subscription_id: string | null;
    stripe_subscription_status: string; stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean; stripe_current_period_end: Date | null;
    stripe_cancel_at_period_end: boolean;
    stripe_connect_mode: "test" | "live" | null; stripe_billing_mode: "test" | "live" | null;
    stripe_identity_verification_session_id: string | null; stripe_identity_verification_mode: "test" | "live" | null;
    age_verification_status: "not_started" | "pending" | "requires_input" | "verified" | "failed";
    age_verification_source: "stripe_identity" | "admin_exception" | null;
    extra_team_seats: number; reserved_worker_count: number;
    pro_trial_used_at_test: Date | null; pro_trial_used_at_live: Date | null;
  }>(`SELECT id::text, stripe_customer_id, stripe_account_id, stripe_subscription_id, stripe_subscription_status,
      stripe_charges_enabled, stripe_payouts_enabled, stripe_current_period_end, stripe_cancel_at_period_end,
      stripe_connect_mode, stripe_billing_mode, stripe_identity_verification_session_id, stripe_identity_verification_mode,
      age_verification_status, age_verification_source, extra_team_seats,
      (SELECT count(DISTINCT lower(member.email))::int FROM provider_team_members member
       WHERE member.provider_id = provider_profiles.id AND member.status IN ('pending', 'active')) AS reserved_worker_count,
      pro_trial_used_at_test, pro_trial_used_at_live
    FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  await reconcileExpiredComplimentaryProGrants(provider.id);
  const complimentaryPro = await getComplimentaryProStatus(provider.id);
  const configuration = stripeConfiguration();
  const mode = getStripeMode();
  if (provider.age_verification_status === "verified" && provider.age_verification_source === "stripe_identity"
      && provider.stripe_identity_verification_mode !== mode) {
    if (await resetMismatchedStripeAgeVerification(provider.id, provider.stripe_identity_verification_mode)) {
      provider.age_verification_status = "not_started";
      provider.age_verification_source = null;
    }
  }
  const hasCurrentConnect = provider.stripe_connect_mode === mode && Boolean(provider.stripe_account_id);
  const hasCurrentBilling = provider.stripe_billing_mode === mode && Boolean(provider.stripe_customer_id);
  let payoutState = providerPayoutSetupState({ connected: hasCurrentConnect, detailsSubmitted: false, payoutsEnabled: false, transfersStatus: null });
  let requirements: string[] = [];
  let disabledReason: string | null = null;
  let taxReportingStatus: string | null = null;
  let cancelAtPeriodEnd = provider.stripe_cancel_at_period_end;
  let subscriptionStateVerified = !provider.stripe_subscription_id;
  if (configuration.secretKey && hasCurrentBilling && provider.stripe_subscription_id) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(provider.stripe_subscription_id);
      if (subscription.metadata.providerId !== provider.id || subscription.metadata.plan !== "pro") {
        throw new Error("Stripe subscription ownership did not match the provider profile.");
      }
      subscriptionStateVerified = true;
      cancelAtPeriodEnd = subscription.cancel_at_period_end;
      const periodEnd = subscriptionPeriodEndUnix(subscription);
      provider.stripe_subscription_status = subscription.status;
      provider.stripe_current_period_end = periodEnd ? new Date(periodEnd * 1000) : null;
      const stripeTeamSeats = extraSeatQuantity(subscription);
      const proAccess = subscriptionProvidesProAccess(subscription.status);
      const terminal = subscription.status === "canceled" || subscription.status === "incomplete_expired";
      const teamSeats = proAccess ? stripeTeamSeats : { itemId: null, quantity: 0 };
      provider.extra_team_seats = teamSeats.quantity;
      await database.query(`UPDATE provider_profiles SET stripe_subscription_status = $2,
        stripe_current_period_end = CASE WHEN $3::bigint IS NULL THEN NULL ELSE to_timestamp($3) END,
        stripe_cancel_at_period_end = $5,
        extra_team_seats = $6, stripe_team_seat_item_id = $7,
        plan = CASE WHEN $8 OR $10 THEN 'pro' ELSE 'starter' END,
        stripe_subscription_id = CASE WHEN $9 THEN NULL ELSE stripe_subscription_id END
        WHERE stripe_subscription_id = $1 AND stripe_billing_mode = $4 AND plan <> 'owner'`,
      [subscription.id, subscription.status, periodEnd, mode, subscription.cancel_at_period_end,
        teamSeats.quantity, teamSeats.itemId, proAccess, terminal, complimentaryPro.active]);
      if (!proAccess && !complimentaryPro.active) {
        await database.query("UPDATE provider_team_members SET status = 'inactive' WHERE provider_id::text = $1 AND status IN ('pending', 'active')", [provider.id]);
      }
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
      payoutState = providerPayoutSetupState({
        connected: true,
        detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        transfersStatus: account.capabilities?.transfers,
        currentlyDue: account.requirements?.currently_due,
        pastDue: account.requirements?.past_due,
        disabledReason,
      });
      await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1 AND stripe_connect_mode = $4", [provider.stripe_account_id, account.charges_enabled, account.payouts_enabled, mode]);
    } catch (error) {
      console.error("Stripe Connect status refresh failed", error);
    }
  }
  if (configuration.secretKey && provider.stripe_identity_verification_session_id && provider.stripe_identity_verification_mode === mode) {
    try {
      const status = await syncProviderAgeVerificationFromStripe(provider.stripe_identity_verification_session_id);
      if (status) provider.age_verification_status = status;
    } catch (error) {
      console.error("Provider age verification status refresh failed", error);
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
    subscriptionStateVerified,
    extraTeamSeats: hasCurrentBilling ? provider.extra_team_seats : 0,
    seatsUsed: provider.reserved_worker_count + 1,
    trialEligible: !complimentaryPro.active && (mode === "live" ? !provider.pro_trial_used_at_live : !provider.pro_trial_used_at_test),
    complimentaryPro: {
      active: complimentaryPro.active,
      startsAt: complimentaryPro.startsAt,
      expiresAt: complimentaryPro.expiresAt,
      lifetime: complimentaryPro.lifetime,
    },
    connect: {
      started: hasCurrentConnect,
      chargesEnabled: hasCurrentConnect && provider.stripe_charges_enabled,
      payoutsEnabled: hasCurrentConnect && provider.stripe_payouts_enabled,
      state: payoutState,
      requirements,
      disabledReason,
      taxReportingStatus,
    },
    ageVerification: { status: provider.age_verification_status },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
