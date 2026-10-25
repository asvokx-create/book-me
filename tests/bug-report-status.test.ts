import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bugReportStatusDetails } from "../lib/bug-report-status.ts";

test("bug report statuses give reporters clear three-step progress", () => {
  assert.deepEqual(bugReportStatusDetails("open"), {
    label: "Submitted",
    description: "The report is waiting for the BubsBookings team to begin review.",
    step: 1,
  });
  assert.equal(bugReportStatusDetails("reviewing").step, 2);
  assert.equal(bugReportStatusDetails("resolved").step, 3);
  assert.equal(bugReportStatusDetails("dismissed").label, "Closed");
});

test("admin review updates notify only the report owner and the reporter page is ownership scoped", async () => {
  const adminRoute = await readFile(new URL("../app/api/admin/issues/route.ts", import.meta.url), "utf8");
  const reporterPage = await readFile(new URL("../app/account/bug-reports/page.tsx", import.meta.url), "utf8");
  const adminQueue = await readFile(new URL("../components/admin-issue-queue.tsx", import.meta.url), "utf8");

  assert.match(adminRoute, /RETURNING id::text, reporter_id/);
  assert.match(adminRoute, /'bug_report_update'/);
  assert.match(adminRoute, /'\/account\/bug-reports'/);
  assert.match(reporterPage, /WHERE reporter_id = \$1/);
  assert.match(reporterPage, /session\.user\.id/);
  assert.doesNotMatch(reporterPage, /admin_note/);
  assert.match(adminQueue, /status === "reviewing"\s*\? issue\.admin_note/);
});
