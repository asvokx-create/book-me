export const ownerDashboardWidgets = [
  "performance",
  "quick-actions",
  "latest-bookings",
  "active-listings",
  "working-hours",
  "profile-setup",
] as const;

export const workerDashboardWidgets = [
  "performance",
  "active-listings",
  "worker-schedule",
] as const;

export type DashboardWidgetId = (typeof ownerDashboardWidgets)[number] | (typeof workerDashboardWidgets)[number];

export const dashboardWidgetDetails: Record<DashboardWidgetId, { label: string; description: string; icon: string }> = {
  performance: { label: "Performance snapshot", description: "Payouts, upcoming jobs, requests, and ratings at a glance.", icon: "▦" },
  "quick-actions": { label: "Quick actions", description: "Shortcuts for services, listings, and working hours.", icon: "↗" },
  "latest-bookings": { label: "Latest requests", description: "Your newest customer booking requests.", icon: "◷" },
  "active-listings": { label: "Active listings", description: "A compact view of the services customers can find.", icon: "◇" },
  "working-hours": { label: "Working hours", description: "Your next saved availability and schedule status.", icon: "□" },
  "profile-setup": { label: "Profile setup", description: "A checklist for getting your company ready to book.", icon: "✓" },
  "worker-schedule": { label: "My schedule", description: "A shortcut for submitting your working hours.", icon: "♙" },
};

export function availableDashboardWidgets(isOwner: boolean): readonly DashboardWidgetId[] {
  return isOwner ? ownerDashboardWidgets : workerDashboardWidgets;
}

export function normalizeDashboardWidgets(value: unknown, isOwner: boolean): DashboardWidgetId[] {
  const available = availableDashboardWidgets(isOwner);
  if (!Array.isArray(value)) return [...available];
  const widgets = value.filter(
    (item, index): item is DashboardWidgetId => typeof item === "string" && available.includes(item as DashboardWidgetId) && value.indexOf(item) === index,
  );
  return widgets.length ? widgets : [...available];
}
