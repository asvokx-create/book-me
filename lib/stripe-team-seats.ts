import "server-only";

import type Stripe from "stripe";
import { getStripe, getStripeMode } from "@/lib/stripe";

export const INCLUDED_PRO_TEAM_SEATS = 3;
export const EXTRA_TEAM_SEAT_PRICE_CENTS = 50;
export const MAX_EXTRA_TEAM_SEATS = 97;
export const TEAM_SEAT_LOOKUP_KEY = "bubs_pro_extra_team_seat_usd_monthly_v1";

export function extraSeatQuantity(subscription: Stripe.Subscription) {
  const item = subscription.items.data.find((entry) =>
    entry.metadata.kind === "pro_extra_team_seat" || entry.price.lookup_key === TEAM_SEAT_LOOKUP_KEY,
  );
  return { itemId: item?.id ?? null, quantity: item?.quantity ?? 0 };
}

export async function getTeamSeatPriceId() {
  const stripe = getStripe();
  const existing = await stripe.prices.list({ active: true, lookup_keys: [TEAM_SEAT_LOOKUP_KEY], limit: 1 });
  const saved = existing.data[0];
  if (saved?.unit_amount === EXTRA_TEAM_SEAT_PRICE_CENTS && saved.recurring?.interval === "month") return saved.id;

  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((entry) => entry.metadata.bubsProductKey === "pro_extra_team_seat");
  if (!product) {
    product = await stripe.products.create({
      name: "BubsBookings Pro extra employee",
      description: "One additional employee seat beyond the three seats included with BubsBookings Pro.",
      metadata: { bubsProductKey: "pro_extra_team_seat" },
    }, { idempotencyKey: `bubs-pro-team-seat-product-${getStripeMode()}` });
  }

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: EXTRA_TEAM_SEAT_PRICE_CENTS,
    recurring: { interval: "month", usage_type: "licensed" },
    product: product.id,
    lookup_key: TEAM_SEAT_LOOKUP_KEY,
    metadata: { kind: "pro_extra_team_seat" },
  }, { idempotencyKey: `bubs-pro-team-seat-price-${getStripeMode()}` });
  return price.id;
}

