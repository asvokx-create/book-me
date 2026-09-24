import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("category discovery separates live supply from coming-soon demand capture", () => {
  const home = read("app", "page.tsx");
  assert.match(home, /populatedCategories/);
  assert.match(home, /upcomingCategories/);
  assert.match(home, /More services coming soon/);
  assert.match(home, /Request a service/);
});

test("brand markup exposes one consistent BubsBookings accessible name", () => {
  const lockup = read("components", "brand-lockup.tsx");
  const layout = read("app", "layout.tsx");
  assert.match(lockup, /role="img" aria-label="BubsBookings"/);
  assert.match(layout, /applicationName: "BubsBookings"/);
  assert.match(layout, /siteName: "BubsBookings"/);
  assert.match(layout, /name: "BubsBookings"/);
});

test("admin recruiting analytics cover city, ZIP, category, demand, and current supply", () => {
  const operations = read("app", "admin", "operations", "page.tsx");
  assert.match(operations, /Providers by city/);
  assert.match(operations, /Providers by ZIP/);
  assert.match(operations, /Providers by category/);
  assert.match(operations, /Demand by city/);
  assert.match(operations, /Demand by category/);
  assert.match(operations, /Supply now/);
  assert.match(operations, /provider_location_service_areas/);
});

test("marketplace lifecycle analytics record real conversion milestones", () => {
  const tracker = read("components", "analytics-tracker.tsx");
  const booking = read("app", "api", "bookings", "route.ts");
  const providerBooking = read("app", "api", "providers", "bookings", "[bookingId]", "route.ts");
  const review = read("app", "api", "bookings", "[bookingId]", "review", "route.ts");
  assert.match(tracker, /provider_profile_view/);
  assert.match(booking, /first_booking_received/);
  assert.match(booking, /customer_rebooked/);
  assert.match(providerBooking, /booking_confirmed/);
  assert.match(providerBooking, /booking_completed/);
  assert.match(review, /review_submitted/);
});

test("new service-location forms do not assume Issaquah", () => {
  const locations = read("components", "location-manager.tsx");
  assert.match(locations, /useState\(""\)/);
  assert.doesNotMatch(locations, /setLocation\("Issaquah, WA"\)/);
});
