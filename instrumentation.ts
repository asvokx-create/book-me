const schedulerState = globalThis as typeof globalThis & {
  __bubsBookingsReminderTimer?: NodeJS.Timeout;
};

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || schedulerState.__bubsBookingsReminderTimer) return;
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
