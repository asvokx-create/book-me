import type { ProviderPayoutSetupState } from "./provider-payout-status";

export type ProviderAgeVerificationStatus = "not_started" | "pending" | "requires_input" | "verified" | "failed";
export type ActivationStepStatus = "completed" | "not_started" | "action_required" | "under_review" | "failed";

export type ListingActivationInput = {
  isActive: boolean;
  ageVerificationBlocked: boolean;
  providerIsActive: boolean;
  companyIsActive: boolean;
  ageVerificationStatus: ProviderAgeVerificationStatus;
};

export function listingInactiveReasons(input: ListingActivationInput) {
  const reasons: string[] = [];
  if (!input.providerIsActive) reasons.push("Your provider account is paused.");
  if (!input.companyIsActive) reasons.push("Your company page is inactive.");
  if (input.ageVerificationStatus !== "verified") {
    reasons.push("Your listing isn’t public yet because you need to complete age verification.");
  }
  if (!input.isActive && !input.ageVerificationBlocked) reasons.push("This service listing is inactive.");
  return reasons;
}

export function ageActivationStep(status: ProviderAgeVerificationStatus) {
  if (status === "verified") return { status: "completed" as const, detail: "Your required age verification is complete." };
  if (status === "pending") return { status: "under_review" as const, detail: "Your age verification is under review." };
  if (status === "requires_input") return { status: "action_required" as const, detail: "Stripe needs more information to complete your age verification." };
  if (status === "failed") return { status: "failed" as const, detail: "Your age verification could not be completed. Please try again." };
  return { status: "not_started" as const, detail: "Complete the required age verification before your listings can become public." };
}

export function payoutActivationStep(state: ProviderPayoutSetupState) {
  if (state === "ready") return { status: "completed" as const, detail: "Your Stripe account is ready to receive payouts." };
  if (state === "under_review") return { status: "under_review" as const, detail: "Your Stripe payout setup is under review." };
  if (state === "action_required") return { status: "action_required" as const, detail: "Stripe needs additional information before payouts can be enabled." };
  if (state === "setup_incomplete") return { status: "action_required" as const, detail: "Finish your Stripe setup to receive payouts." };
  return { status: "not_started" as const, detail: "Connect your Stripe account to receive payouts." };
}
