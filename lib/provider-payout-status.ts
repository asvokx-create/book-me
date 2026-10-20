export type ProviderPayoutSetupState = "not_connected" | "setup_incomplete" | "under_review" | "action_required" | "ready";

type ProviderPayoutAccount = {
  connected: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersStatus: string | null | undefined;
  currentlyDue?: string[] | null;
  pastDue?: string[] | null;
  disabledReason?: string | null;
};

export function providerPayoutSetupState(account: ProviderPayoutAccount): ProviderPayoutSetupState {
  if (!account.connected) return "not_connected";

  if (!account.detailsSubmitted) return "setup_incomplete";
  const outstanding = [...(account.currentlyDue ?? []), ...(account.pastDue ?? [])];
  if (outstanding.length > 0 || account.disabledReason) return "action_required";
  if (!account.payoutsEnabled || account.transfersStatus !== "active") return "under_review";
  return "ready";
}

export function providerPayoutReminderCopy(state: Exclude<ProviderPayoutSetupState, "ready">) {
  if (state === "not_connected") return "Connect your Stripe account to receive payouts.";
  if (state === "setup_incomplete") return "Finish your Stripe setup to receive payouts.";
  if (state === "under_review") return "Your Stripe payout setup is under review. We’ll update your status when Stripe completes its review.";
  return "Stripe needs additional information before payouts can be enabled.";
}
