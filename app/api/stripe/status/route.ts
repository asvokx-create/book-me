import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, stripeConfiguration } from "@/lib/stripe";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{
    stripe_customer_id: string | null; stripe_account_id: string | null;
    stripe_subscription_status: string; stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean; stripe_current_period_end: Date | null;
  }>(`SELECT stripe_customer_id, stripe_account_id, stripe_subscription_status,
      stripe_charges_enabled, stripe_payouts_enabled, stripe_current_period_end
    FROM provider_profiles WHERE user_id = $1 AND is_active = true`, [session.user.id]);
  const provider = result.rows[0];
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const configuration = stripeConfiguration();
  if (configuration.secretKey && provider.stripe_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(provider.stripe_account_id);
      provider.stripe_charges_enabled = account.charges_enabled;
      provider.stripe_payouts_enabled = account.payouts_enabled;
      await database.query("UPDATE provider_profiles SET stripe_charges_enabled = $2, stripe_payouts_enabled = $3 WHERE stripe_account_id = $1", [provider.stripe_account_id, account.charges_enabled, account.payouts_enabled]);
    } catch (error) {
      console.error("Stripe Connect status refresh failed", error);
    }
  }
  return NextResponse.json({
    configured: Object.values(configuration).every(Boolean),
    missingConfiguration: Object.entries(configuration).filter(([, present]) => !present).map(([name]) => name),
    hasCustomer: Boolean(provider.stripe_customer_id),
    subscriptionStatus: provider.stripe_subscription_status,
    currentPeriodEnd: provider.stripe_current_period_end,
    connect: {
      started: Boolean(provider.stripe_account_id),
      chargesEnabled: provider.stripe_charges_enabled,
      payoutsEnabled: provider.stripe_payouts_enabled,
    },
  });
}
