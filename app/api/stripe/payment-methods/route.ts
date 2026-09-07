import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getConsumerStripeCustomer, getOrCreateConsumerStripeCustomer } from "@/lib/customer-stripe";
import { enforceRateLimit } from "@/lib/request-security";
import { getStripe, getStripeMode } from "@/lib/stripe";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to manage payment methods." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ configured: false, mode: getStripeMode(), paymentMethods: [] });
  const customerId = await getConsumerStripeCustomer(session.user.id);
  if (!customerId) return NextResponse.json({ configured: true, mode: getStripeMode(), paymentMethods: [] });
  try {
    const methods = await getStripe().paymentMethods.list({ customer: customerId, type: "card", limit: 20 });
    return NextResponse.json({
      configured: true,
      mode: getStripeMode(),
      paymentMethods: methods.data.map((method) => ({
        id: method.id,
        brand: method.card?.display_brand ?? method.card?.brand ?? "card",
        last4: method.card?.last4 ?? "",
        expMonth: method.card?.exp_month ?? null,
        expYear: method.card?.exp_year ?? null,
      })),
    });
  } catch (error) {
    console.error("Consumer payment methods failed to load", error);
    return NextResponse.json({ error: "We could not load your saved payment methods." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to add a payment method." }, { status: 401 });
    if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Secure payments are not configured yet." }, { status: 503 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-payment-method-setup", limit: 8 })) {
      return NextResponse.json({ error: "Too many payment setup attempts. Please wait and try again." }, { status: 429 });
    }
    const customerId = await getOrCreateConsumerStripeCustomer({ userId: session.user.id, email: session.user.email, name: session.user.name });
    const origin = new URL(request.url).origin;
    const checkout = await getStripe().checkout.sessions.create({
      mode: "setup",
      currency: "usd",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${origin}/account/payments?setup=success`,
      cancel_url: `${origin}/account/payments?setup=cancelled`,
      metadata: { kind: "consumer_payment_method_setup", userId: session.user.id },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Consumer payment setup failed", error);
    return NextResponse.json({ error: "Stripe payment setup is temporarily unavailable. Please try again." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Log in to remove a payment method." }, { status: 401 });
    if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "stripe-payment-method-remove", limit: 12 })) {
      return NextResponse.json({ error: "Too many payment changes. Please wait and try again." }, { status: 429 });
    }
    const body = await request.json() as { paymentMethodId?: unknown };
    const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : "";
    const customerId = await getConsumerStripeCustomer(session.user.id);
    if (!customerId || !paymentMethodId.startsWith("pm_")) return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
    const paymentMethod = await getStripe().paymentMethods.retrieve(paymentMethodId);
    const ownerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;
    if (ownerId !== customerId) return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
    await getStripe().paymentMethods.detach(paymentMethodId);
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Consumer payment method removal failed", error);
    return NextResponse.json({ error: "We could not remove that payment method." }, { status: 502 });
  }
}
