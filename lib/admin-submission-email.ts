import "server-only";

import { sendTransactionalEmail } from "./email";

export const ADMIN_SUBMISSION_EMAIL = "christian@bubsbookings.com";

export async function sendAdminBugReportEmail(reportId: string) {
  return sendTransactionalEmail({
    to: ADMIN_SUBMISSION_EMAIL,
    subject: "New BubsBookings bug report",
    heading: "A new bug report was filed",
    message: "A signed-in BubsBookings user submitted a bug report. Review the report in the secure admin dashboard.",
    actionLabel: "Review bug report",
    actionUrl: "/admin/reported-bugs",
    emailType: "admin_bug_report",
    idempotencyKey: `admin-bug-report-${reportId}`,
  });
}

export async function sendAdminDisputeEmail(disputeId: string) {
  return sendTransactionalEmail({
    to: ADMIN_SUBMISSION_EMAIL,
    subject: "New BubsBookings booking dispute",
    heading: "A new booking dispute was filed",
    message: "A BubsBookings user opened a booking dispute. Review the case in the secure admin dashboard before taking action.",
    actionLabel: "Review dispute",
    actionUrl: "/admin/disputes",
    emailType: "admin_booking_dispute",
    idempotencyKey: `admin-booking-dispute-${disputeId}`,
  });
}
