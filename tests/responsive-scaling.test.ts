import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("shared layout tokens cap reading, content, marketplace, and dashboard widths", () => {
  const css = read("app", "globals.css");

  for (const token of ["--layout-reading", "--layout-content", "--layout-wide", "--layout-dashboard", "--layout-gutter"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /\.site-container \{ max-width: var\(--layout-content\); \}/);
  assert.match(css, /\.site-container-wide \{ max-width: var\(--layout-wide\); \}/);
  assert.match(css, /\.dashboard-container \{ max-width: var\(--layout-dashboard\); \}/);
  assert.match(css, /\.reading-measure \{ max-width: 72ch; \}/);
});

test("large displays gain useful columns without allowing cards and booking panels to stretch", () => {
  const home = read("app", "page.tsx");
  const services = read("app", "services", "page.tsx");
  const listing = read("app", "services", "[slug]", "page.tsx");
  const bookingPanel = read("components", "stationary-booking-panel.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-popular-grid/);
  assert.match(css, /\.home-popular-grid \{ display: grid; grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(services, /min-\[1536px\]:grid-cols-4/);
  assert.match(listing, /minmax\(20rem,25rem\)/);
  assert.match(bookingPanel, /service-booking-panel/);
  assert.match(listing, /service-booking-column/);
  assert.match(css, /\.service-booking-column[\s\S]*?max-width: 25rem/);
});

test("application shells and messages use bounded wide-screen layouts", () => {
  const account = read("app", "account", "page.tsx");
  const admin = read("components", "admin-dashboard.tsx");
  const provider = read("components", "provider-dashboard.tsx");
  const messages = read("components", "messaging-center.tsx");
  const css = read("app", "globals.css");

  assert.match(account, /dashboard-container/);
  assert.match(admin, /dashboard-container/);
  assert.match(provider, /dashboard-shell dashboard-container/);
  assert.match(messages, /message-bubble/);
  assert.match(css, /max-width: min\(82%, 44rem\)/);
});

test("the global responsive system preserves mobile viewport safety", () => {
  const css = read("app", "globals.css");
  const layout = read("app", "layout.tsx");

  assert.match(css, /overflow-x: clip/);
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(layout, /user-scalable=no/);
});

test("homepage category navigation stays compact without collapsing its icons", () => {
  const home = read("app", "page.tsx");
  const categoryIcon = read("components", "service-category-icon.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /HOME_CATEGORIES\.map/);
  assert.match(home, /home-category-card home-category-more/);
  assert.match(css, /\.home-redesign \.home-category-grid \{ display: grid; grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/);
  assert.match(categoryIcon, /shrink-0[^\"]*aspect-square/);
  assert.match(categoryIcon, /h-10 min-h-10 w-10 min-w-10/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.home-redesign \.home-category-grid \{ display: flex/);
});

test("iPhone layouts keep trust points, listing media, and service details readable", () => {
  const home = read("app", "page.tsx");
  const listing = read("app", "services", "[slug]", "page.tsx");
  const css = read("app", "globals.css");

  assert.doesNotMatch(css, /home-hero-points > span:nth-child\(n\+2\)[^{]*\{[^}]*display:\s*none/);
  assert.match(css, /\.home-hero-points[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.home-service-card[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.home-service-card > a:first-child > div[\s\S]*?aspect-ratio: 16 \/ 9/);
  assert.match(home, /\(max-width: 639px\) calc\(100vw - 32px\)/);
  assert.match(listing, /service-detail-meta-primary/);
  assert.match(listing, /service-detail-provider/);
  assert.match(listing, /service-detail-trust/);
  assert.match(listing, /service-detail-contact/);
  assert.match(listing, /<UiIcon name="map-pin"/);
  assert.match(css, /\.service-detail-contact \{ width: 100%; \}/);
});

test("mobile distance filters keep the complete selected radius visible", () => {
  const css = read("app", "globals.css");
  const locationFilter = read("components", "location-filter.tsx");
  const radiusSelector = read("components", "radius-selector.tsx");

  assert.match(locationFilter, /location-filter-radius/);
  assert.match(locationFilter, /function changeRadius\(nextRadius: number\)[\s\S]*?setRadius\(nextRadius\)[\s\S]*?remember\(location, nextRadius\)[\s\S]*?navigateToLocation\(location, nextRadius\)/);
  assert.match(radiusSelector, /label: `\$\{radius\} miles`/);
  assert.match(radiusSelector, /PRESET_RADII = \[5, 10, 25, 50, 100, 250\]/);
  assert.match(radiusSelector, /min-w-\[7\.5rem\] flex-1/);
  assert.match(css, /\.compact-radius-select > span:first-child \{[\s\S]*?overflow: visible;[\s\S]*?text-overflow: clip;[\s\S]*?white-space: nowrap;/);
  assert.match(css, /\.home-search-location \.location-filter \{ flex-direction: column;/);
  assert.match(css, /\.home-search-location \.location-filter-radius \{ width: 100%;[\s\S]*?justify-content: space-between;/);
  assert.doesNotMatch(css, /\.home-search-location > div > div:last-child[^}]*flex: 0 0 6\.6rem/);
});

test("narrow marketplace controls preserve readable text and stack before they crowd", () => {
  const home = read("components", "home-service-search.tsx");
  const services = read("app", "services", "page.tsx");
  const sort = read("components", "sort-select.tsx");
  const filters = read("components", "service-filters-menu.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-search-input flex min-w-0 flex-1/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.home-search-input[\s\S]*?padding-inline: \.75rem/);
  assert.match(css, /main > header a[\s\S]*?min-height: 2\.75rem/);
  assert.match(css, /#all-filters:has\(details\[open\]\)[\s\S]*?z-index: 120/);
  assert.match(services, /grid-cols-1 gap-2 min-\[400px\]:grid-cols-2 sm:grid-cols-3/);
  assert.match(services, /mobile-scroll-row -ml-4 flex min-w-0 flex-1/);
  assert.match(filters, /aria-label="Close filters"/);
  assert.match(filters, /group-open:grid sm:group-open:hidden/);
  assert.match(services, /flex min-w-0 items-center gap-2 rounded-xl/);
  assert.match(services, /flex-col items-stretch gap-4[^"]*sm:flex-row[^"]*sm:items-end/);
  assert.match(sort, /sort-control flex min-h-11 max-w-full/);
  assert.match(sort, /sort-control-select min-w-0/);
});

test("the reusable support action keeps card spacing and a full touch target", () => {
  const supportButton = read("components", "contact-support-button.tsx");
  const account = read("app", "account", "page.tsx");

  assert.match(supportButton, /inline-flex min-h-11 items-center justify-center/);
  assert.match(account, /ContactSupportButton className="mt-4/);
});
