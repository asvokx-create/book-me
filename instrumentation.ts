const schedulerState = globalThis as typeof globalThis & {
  __bubsBookingsReminderTimer?: NodeJS.Timeout;
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

  if (schedulerState.__bubsBookingsReminderTimer) return;
  if (!process.env.DATABASE_URL || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;

  const { runBookingReminders } = await import("./lib/booking-reminders");
  const run = () => {
    void runBookingReminders().catch((error) => console.error("Scheduled booking reminders failed", error));
  };
  const initialRun = setTimeout(run, 60_000);
  initialRun.unref();
  schedulerState.__bubsBookingsReminderTimer = setInterval(run, 10 * 60_000);
  schedulerState.__bubsBookingsReminderTimer.unref();
}
