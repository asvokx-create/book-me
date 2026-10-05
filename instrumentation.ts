const schedulerState = globalThis as typeof globalThis & {
  __bubsBookingsReminderTimer?: NodeJS.Timeout;
  __bubsBookingsMarketingTimer?: NodeJS.Timeout;
};

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;

  const requiredVariables = ["DATABASE_URL", "DATABASE_CA_CERT", "RESEND_API_KEY", "EMAIL_FROM"] as const;
  const missingVariables: string[] = requiredVariables.filter((key) => !process.env[key]?.trim());
  const authSecret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!authSecret || authSecret.length < 32) missingVariables.push("BETTER_AUTH_SECRET");
  if (missingVariables.length > 0) {
    throw new Error(`Missing or invalid production configuration: ${missingVariables.join(", ")}`);
  }

  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;

  if (!schedulerState.__bubsBookingsReminderTimer) {
    const { runBookingReminders } = await import("./lib/booking-reminders");
    const runReminders = () => {
      void runBookingReminders().catch((error) => console.error("Scheduled booking reminders failed", error));
    };
    const initialReminderRun = setTimeout(runReminders, 60_000);
    initialReminderRun.unref();
    schedulerState.__bubsBookingsReminderTimer = setInterval(runReminders, 10 * 60_000);
    schedulerState.__bubsBookingsReminderTimer.unref();
  }

  if (!schedulerState.__bubsBookingsMarketingTimer) {
    const { runMarketingCampaignBatch } = await import("./lib/marketing-jobs");
    const runMarketing = () => {
      void runMarketingCampaignBatch().catch((error) => console.error("Scheduled marketing campaign delivery failed", error));
    };
    const initialMarketingRun = setTimeout(runMarketing, 90_000);
    initialMarketingRun.unref();
    schedulerState.__bubsBookingsMarketingTimer = setInterval(runMarketing, 5 * 60_000);
    schedulerState.__bubsBookingsMarketingTimer.unref();
  }
}
