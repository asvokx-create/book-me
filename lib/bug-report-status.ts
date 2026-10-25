export type BugReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export function bugReportStatusDetails(status: string) {
  if (status === "reviewing") return {
    label: "Under review",
    description: "The BubsBookings team is reviewing the report.",
    step: 2,
  };
  if (status === "resolved") return {
    label: "Resolved",
    description: "The BubsBookings team completed the fix or confirmed the issue is resolved.",
    step: 3,
  };
  if (status === "dismissed") return {
    label: "Closed",
    description: "The review is complete and the report has been closed.",
    step: 3,
  };
  return {
    label: "Submitted",
    description: "The report is waiting for the BubsBookings team to begin review.",
    step: 1,
  };
}
