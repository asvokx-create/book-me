import type Stripe from "stripe";

type WebhookVerifier = Pick<Stripe, "webhooks">;

export function parseVerifiedStripeEvent(
  stripe: WebhookVerifier,
  payload: string,
  signature: string,
  secret: string,
) {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export function stripeEventMatchesMode(event: Stripe.Event, mode: "test" | "live") {
  return event.livemode === (mode === "live");
}

export function canApplyBookingPaymentTransition(
  current: "unpaid" | "pending" | "failed" | "paid" | "refunded",
  next: "failed" | "paid",
) {
  if (next === "failed") return current === "unpaid" || current === "pending" || current === "failed";
  return current === "unpaid" || current === "pending" || current === "failed" || current === "paid";
}

export function stripeTransferMatches(
  transfer: Pick<Stripe.Transfer, "amount" | "destination">,
  expected: { amountCents: number; connectedAccountId: string },
) {
  const destination = typeof transfer.destination === "string" ? transfer.destination : transfer.destination?.id;
  return transfer.amount === expected.amountCents && destination === expected.connectedAccountId;
}
