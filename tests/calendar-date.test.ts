import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { addDateOnlyDays, calendarGrid, formatDateOnly, parseDateOnly, shiftCalendarMonth, todayDateOnly } from "../lib/calendar-date.ts";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("date-only helpers validate real calendar dates", () => {
  assert.deepEqual(parseDateOnly("2028-02-29"), { year: 2028, month: 2, day: 29 });
  assert.equal(parseDateOnly("2027-02-29"), null);
  assert.equal(parseDateOnly("2026-13-01"), null);
  assert.equal(parseDateOnly("09/24/2026"), null);
});

test("date-only arithmetic crosses month, year, and daylight-saving boundaries", () => {
  assert.equal(addDateOnlyDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDateOnlyDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDateOnlyDays("2026-11-01", -1), "2026-10-31");
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
});

test("the calendar grid aligns dates and preserves date-only display values", () => {
  const grid = calendarGrid({ year: 2026, month: 9 });
  assert.equal(grid[0], null);
  assert.equal(grid[2], "2026-09-01");
  assert.equal(grid[31], "2026-09-30");
  assert.equal(grid.length % 7, 0);
  assert.equal(formatDateOnly("2026-09-24"), "September 24, 2026");
  assert.equal(todayDateOnly(new Date(2026, 8, 24, 23, 30)), "2026-09-24");
});

test("booking calendar retains the existing date-only booking contract", () => {
  const picker = readFileSync(join(projectRoot, "components", "booking-date-picker.tsx"), "utf8");
  const bookingCard = readFileSync(join(projectRoot, "app", "services", "[slug]", "booking-card.tsx"), "utf8");
  const availabilityRoute = readFileSync(join(projectRoot, "app", "api", "services", "[serviceId]", "availability", "route.ts"), "utf8");

  assert.doesNotMatch(picker, /toISOString\(/);
  assert.doesNotMatch(bookingCard, /type="date"/);
  assert.match(bookingCard, /<BookingDatePicker/);
  assert.match(availabilityRoute, /monthPattern = \/\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$\//);
  assert.match(availabilityRoute, /return NextResponse\.json\(\{ dates:/);
  assert.match(availabilityRoute, /return NextResponse\.json\(\{ times:/);
});

test("the desktop booking panel stays stationary without nested scrolling", () => {
  const css = readFileSync(join(projectRoot, "app", "globals.css"), "utf8");
  const bookingCard = readFileSync(join(projectRoot, "app", "services", "[slug]", "booking-card.tsx"), "utf8");
  const stickyRule = css.match(/@media \(min-width: 1024px\) and \(min-height: 790px\) \{[\s\S]*?\.service-booking-panel \{([\s\S]*?)\n  \}/)?.[1] ?? "";

  assert.match(stickyRule, /position: sticky/);
  assert.match(stickyRule, /overflow: visible/);
  assert.doesNotMatch(stickyRule, /overflow-y: auto|max-height|scrollbar/);
  assert.ok((bookingCard.match(/lg:hidden/g) ?? []).length >= 3);
});
