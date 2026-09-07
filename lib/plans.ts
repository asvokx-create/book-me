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
    customBookingQuestions: false,
    reminderHours: [24],
    repeatCustomerTools: false,
    multipleLocations: false,
    prioritySupport: false,
    featuredPlacement: false,
  },
  pro: {
    name: "Pro",
    monthlyPrice: 9.99,
    bookingFeePercent: 4,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: 3,
    advancedAnalytics: true,
    customBookingQuestions: true,
    reminderHours: [24, 1],
    repeatCustomerTools: true,
    multipleLocations: true,
    prioritySupport: true,
    featuredPlacement: true,
  },
  business: {
    name: "Business",
    monthlyPrice: 49.99,
    bookingFeePercent: 2,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: null,
    advancedAnalytics: true,
    customBookingQuestions: true,
    reminderHours: [24, 1],
    repeatCustomerTools: true,
    multipleLocations: true,
    prioritySupport: true,
    featuredPlacement: true,
  },
  owner: {
    name: "Owner Plan",
    monthlyPrice: 0,
    bookingFeePercent: 0,
    serviceLimit: null,
    photoLimit: null,
    teamSeatLimit: null,
    advancedAnalytics: true,
    customBookingQuestions: true,
    reminderHours: [24, 1],
    repeatCustomerTools: true,
    multipleLocations: true,
    prioritySupport: true,
    featuredPlacement: true,
  },
} as const satisfies Record<ProviderPlan, {
  name: string;
  monthlyPrice: number;
  bookingFeePercent: number;
  serviceLimit: number | null;
  photoLimit: number | null;
  teamSeatLimit: number | null;
  advancedAnalytics: boolean;
  customBookingQuestions: boolean;
  reminderHours: readonly number[];
  repeatCustomerTools: boolean;
  multipleLocations: boolean;
  prioritySupport: boolean;
  featuredPlacement: boolean;
}>;

export function isProviderPlan(value: unknown): value is ProviderPlan {
  return value === "starter" || value === "pro" || value === "business" || value === "owner";
}

export function isPurchasableProviderPlan(value: unknown): value is "pro" {
  return value === "pro";
}
