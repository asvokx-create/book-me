import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("new bug reports email the administrator once without exposing report content", () => {
  const helper = read("lib/admin-submission-email.ts");
  const route = read("app/api/bug-reports/route.ts");

  assert.match(helper, /ADMIN_SUBMISSION_EMAIL = "christian@bubsbookings\.com"/);
  assert.match(helper, /emailType: "admin_bug_report"/);
  assert.match(helper, /idempotencyKey: `admin-bug-report-\$\{reportId\}`/);
  assert.match(helper, /actionUrl: "\/admin\/reported-bugs"/);
  assert.doesNotMatch(helper, /details|steps_to_reproduce|pageUrl/);
  assert.match(route, /await sendAdminBugReportEmail\(result\.rows\[0\]\.id\)/);
  assert.ok(route.lastIndexOf("sendAdminBugReportEmail") > route.indexOf("INSERT INTO bug_reports"));
});

test("new booking disputes email the administrator only after the transaction commits", () => {
  const helper = read("lib/admin-submission-email.ts");
  const route = read("app/api/disputes/route.ts");

  assert.match(helper, /emailType: "admin_booking_dispute"/);
  assert.match(helper, /idempotencyKey: `admin-booking-dispute-\$\{disputeId\}`/);
  assert.match(helper, /actionUrl: "\/admin\/disputes"/);
  assert.doesNotMatch(helper, /requestedResolution|against_user_id/);
  assert.match(route, /await sendAdminDisputeEmail\(result\.rows\[0\]\.id\)/);
  assert.ok(route.lastIndexOf("sendAdminDisputeEmail") > route.indexOf('client.query("COMMIT")'));
});

test("transactional delivery failures are contained by the shared email utility", () => {
  const email = read("lib/email.ts");
  assert.match(email, /catch \(error\)[\s\S]*?recordDelivery\(input, "failed"/);
  assert.match(email, /return \{ sent: false, skipped: false, providerMessageId: "", error: message \}/);
});
