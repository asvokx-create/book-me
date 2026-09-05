import "server-only";

import Stripe from "stripe";
import type { ProviderPlan } from "@/lib/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured.");
  stripeClient ??= new Stripe(secretKey);
  return stripeClient;
}

export function getStripePriceId(plan: ProviderPlan) {
  if (plan === "pro") return process.env.STRIPE_PRO_PRICE_ID ?? "";
  if (plan === "business") return process.env.STRIPE_BUSINESS_PRICE_ID ?? "";
  return "";
}

export function stripeConfiguration() {
  return {
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    proPrice: Boolean(process.env.STRIPE_PRO_PRICE_ID),
    businessPrice: Boolean(process.env.STRIPE_BUSINESS_PRICE_ID),
  };
}

export function isStripeReady() {
  return Object.values(stripeConfiguration()).every(Boolean);
}
