import assert from "node:assert/strict";
import test from "node:test";
import { isValidTimeZone, zonedDateTimeToUtc } from "../lib/zoned-date-time.ts";

test("converts Pacific noon to the correct UTC instant during daylight time", () => {
  assert.equal(zonedDateTimeToUtc("2026-09-23", "12:00", "America/Los_Angeles")?.toISOString(), "2026-09-23T19:00:00.000Z");
});

test("converts Pacific noon to the correct UTC instant during standard time", () => {
  assert.equal(zonedDateTimeToUtc("2026-12-23", "12:00", "America/Los_Angeles")?.toISOString(), "2026-12-23T20:00:00.000Z");
});

test("rejects an invalid time zone and a skipped daylight-saving time", () => {
  assert.equal(isValidTimeZone("Not/A_Time_Zone"), false);
  assert.equal(zonedDateTimeToUtc("2026-03-08", "02:30", "America/Los_Angeles"), null);
});
