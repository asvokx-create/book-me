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
  }>(`SELECT stripe_customer_id, stripe_account_id, stripe_subscription_status,
      stripe_charges_enabled, stripe_payouts_enabled, stripe_current_period_end,
      stripe_connect_mode, stripe_billing_mode
    FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const configuration = stripeConfiguration();
  const mode = getStripeMode();
  const hasCurrentConnect = provider.stripe_connect_mode === mode && Boolean(provider.stripe_account_id);
  const hasCurrentBilling = provider.stripe_billing_mode === mode && Boolean(provider.stripe_customer_id);
  if (configuration.secretKey && hasCurrentConnect && provider.stripe_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(provider.stripe_account_id);
      provider.stripe_charges_enabled = account.charges_enabled;
      provider.stripe_payouts_enabled = account.payouts_enabled;
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
    connect: {
      started: hasCurrentConnect,
      chargesEnabled: hasCurrentConnect && provider.stripe_charges_enabled,
      payoutsEnabled: hasCurrentConnect && provider.stripe_payouts_enabled,
    },
  });
}
