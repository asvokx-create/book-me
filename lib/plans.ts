export type ProviderPlan = "starter" | "pro" | "business" | "owner";

export const PLAN_ENTITLEMENTS = {
  starter: {
    name: "Starter",
    monthlyPrice: 0,
    bookingFeePercent: 10,
    serviceLimit: 2,
    photoLimit: 5,
    teamSeatLimit: 1,
    advancedAnalytics: false,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 19.99,
    bookingFeePercent: 4,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: 3,
    advancedAnalytics: true,
  },
  business: {
    name: "Business",
    monthlyPrice: 49.99,
    bookingFeePercent: 2,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: null,
    advancedAnalytics: true,
  },
  owner: {
    name: "Owner Plan",
    monthlyPrice: 0,
    bookingFeePercent: 0,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: null,
    advancedAnalytics: true,
  },
} as const satisfies Record<ProviderPlan, {
  name: string;
  monthlyPrice: number;
  bookingFeePercent: number;
  serviceLimit: number | null;
  photoLimit: number | null;
  teamSeatLimit: number | null;
  advancedAnalytics: boolean;
}>;

export function isProviderPlan(value: unknown): value is ProviderPlan {
  return value === "starter" || value === "pro" || value === "business" || value === "owner";
}

export function isPurchasableProviderPlan(value: unknown): value is "pro" | "business" {
  return value === "pro" || value === "business";
}
