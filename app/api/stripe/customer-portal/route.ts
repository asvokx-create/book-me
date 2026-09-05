import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const result = await database.query<{ stripe_customer_id: string | null; stripe_billing_mode: "test" | "live" | null }>(
    "SELECT stripe_customer_id, stripe_billing_mode FROM provider_profiles WHERE user_id = $1 AND is_active = true", [session.user.id],
  );
  const customerId = result.rows[0]?.stripe_billing_mode === getStripeMode() ? result.rows[0]?.stripe_customer_id : null;
  if (!customerId) return NextResponse.json({ error: "No Stripe billing account is connected yet." }, { status: 404 });
  const portal = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${new URL(request.url).origin}/provider/dashboard/billing` });
  return NextResponse.json({ url: portal.url });
}
