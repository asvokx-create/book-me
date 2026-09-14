import "server-only";

import type Stripe from "stripe";

export const PRO_MONTHLY_PRICE_CENTS = 999;
export const PRO_MONTHLY_PRICE_LOOKUP_KEY = "bubs_pro_usd_monthly_v1";

function isCurrentProMonthlyPrice(price: Stripe.Price) {
  return price.active
    && price.currency === "usd"
    && price.unit_amount === PRO_MONTHLY_PRICE_CENTS
    && price.type === "recurring"
    && price.recurring?.interval === "month"
    && price.recurring.interval_count === 1;
}

export async function getProMonthlyPriceId(stripe: Stripe) {
  const lookupPrices = await stripe.prices.list({
    active: true,
    lookup_keys: [PRO_MONTHLY_PRICE_LOOKUP_KEY],
    limit: 10,
  });
  const lookupPrice = lookupPrices.data.find(isCurrentProMonthlyPrice);
  if (lookupPrice) return lookupPrice.id;

  const products = await stripe.products.search({
    query: "active:'true' AND name:'BubsBookings Pro'",
    limit: 10,
  });
  for (const product of products.data) {
    const productPrices = await stripe.prices.list({ active: true, product: product.id, limit: 100 });
    const matchingPrice = productPrices.data.find(isCurrentProMonthlyPrice);
    if (matchingPrice) return matchingPrice.id;
  }

  throw new Error("The active BubsBookings Pro price must be configured in Stripe at $9.99 per month.");
}
