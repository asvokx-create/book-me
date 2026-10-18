export type SubscriptionLifecycle = {
  status: string;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  items: { data: Array<{ current_period_end: number }> };
};

export function subscriptionPeriodEndUnix(subscription: SubscriptionLifecycle) {
  return subscription.status === "trialing"
    ? subscription.trial_end
    : subscription.items.data[0]?.current_period_end ?? null;
}

export function canScheduleSubscriptionCancellation(status: string) {
  return ["active", "trialing", "past_due", "unpaid", "paused"].includes(status);
}

export function cancellationSettingForAction(action: "cancel" | "resume") {
  return action === "cancel";
}

export function requireConfirmedCancellationSetting(expected: boolean, confirmed: boolean) {
  if (expected !== confirmed) throw new Error("Stripe did not confirm the requested subscription state.");
}

export async function applyCancellationSetting<T extends SubscriptionLifecycle & { id: string }>(input: {
  subscription: T;
  action: "cancel" | "resume";
  operationId: string;
  update: (id: string, cancelAtPeriodEnd: boolean, idempotencyKey: string) => Promise<T>;
}) {
  const existingPeriodEnd = subscriptionPeriodEndUnix(input.subscription);
  if (!existingPeriodEnd) throw new Error("Stripe did not return the subscription period end.");
  const cancelAtPeriodEnd = cancellationSettingForAction(input.action);
  const stateChanged = input.subscription.cancel_at_period_end !== cancelAtPeriodEnd;
  const subscription = stateChanged
    ? await input.update(
      input.subscription.id,
      cancelAtPeriodEnd,
      `provider-subscription-${input.action}-${input.subscription.id}-${input.operationId}`,
    )
    : input.subscription;
  requireConfirmedCancellationSetting(cancelAtPeriodEnd, subscription.cancel_at_period_end);
  return {
    subscription,
    stateChanged,
    cancelAtPeriodEnd,
    periodEnd: subscriptionPeriodEndUnix(subscription) ?? existingPeriodEnd,
  };
}

export function shouldApplySubscriptionEvent(lastEventCreated: number | null, eventCreated: number) {
  return lastEventCreated === null || eventCreated >= lastEventCreated;
}
