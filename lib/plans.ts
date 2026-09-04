export type ProviderPlan = "starter" | "pro" | "business";

export const PLAN_ENTITLEMENTS = {
  starter: {
    name: "Starter",
    monthlyPrice: 0,
    bookingFeePercent: 8,
    serviceLimit: 5,
    photoLimit: 10,
    teamSeatLimit: 1,
    advancedAnalytics: false,
    aiAssistant: false,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 19.99,
    bookingFeePercent: 4,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: 3,
    advancedAnalytics: true,
    aiAssistant: true,
  },
  business: {
    name: "Business",
    monthlyPrice: 49.99,
    bookingFeePercent: 2,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: null,
    advancedAnalytics: true,
    aiAssistant: true,
  },
} as const satisfies Record<ProviderPlan, {
  name: string;
  monthlyPrice: number;
  bookingFeePercent: number;
  serviceLimit: number | null;
  photoLimit: number | null;
  teamSeatLimit: number | null;
  advancedAnalytics: boolean;
  aiAssistant: boolean;
}>;

export function isProviderPlan(value: unknown): value is ProviderPlan {
  return value === "starter" || value === "pro" || value === "business";
}
