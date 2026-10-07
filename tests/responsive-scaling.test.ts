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

  assert.match(home, /min-\[1536px\]:grid-cols-4/);
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

test("upcoming service categories stay compact without collapsing their icons", () => {
  const home = read("app", "page.tsx");
  const categoryIcon = read("components", "service-category-icon.tsx");
  const categoryCard = read("components", "upcoming-category-card.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-upcoming-grid mt-4 grid gap-2/);
  assert.match(css, /grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 11\.75rem\), 1fr\)\)/);
  assert.match(categoryCard, /home-upcoming-category[^\"]*min-h-12[^\"]*min-w-0[^\"]*gap-3[^\"]*rounded-lg/);
  assert.match(categoryCard, /text-\[13px\][^\"]*sm:text-sm/);
  assert.match(categoryCard, /home-upcoming-label min-w-0 flex-1/);
  assert.doesNotMatch(categoryCard, /whitespace-nowrap/);
  assert.match(categoryIcon, /shrink-0[^\"]*aspect-square/);
  assert.match(categoryIcon, /h-10 min-h-10 w-10 min-w-10/);
  assert.match(css, /@media \(min-width: 480px\) and \(max-width: 639px\)[\s\S]*?\.home-upcoming-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.home-upcoming-label[\s\S]*?white-space: normal;[\s\S]*?word-break: normal;[\s\S]*?overflow-wrap: normal/);
});

test("iPhone layouts keep trust points, listing media, and service details readable", () => {
  const home = read("app", "page.tsx");
  const listing = read("app", "services", "[slug]", "page.tsx");
  const css = read("app", "globals.css");

  assert.doesNotMatch(css, /home-hero-points > span:nth-child\(n\+2\)[^{]*\{[^}]*display:\s*none/);
  assert.match(css, /\.home-hero-points[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.home-service-card[\s\S]*?grid-template-columns: minmax\(0, 43\.5%\) minmax\(0, 56\.5%\)/);
  assert.match(home, /\(max-width: 340px\) calc\(100vw - 32px\)[^"\n]*\(max-width: 639px\) 44vw/);
  assert.match(listing, /service-detail-meta-primary/);
  assert.match(listing, /service-detail-provider/);
  assert.match(listing, /service-detail-trust/);
  assert.match(listing, /service-detail-contact/);
  assert.match(listing, /<UiIcon name="map-pin"/);
  assert.match(css, /\.service-detail-contact \{ width: 100%; \}/);
});

test("narrow marketplace controls preserve readable text and stack before they crowd", () => {
  const home = read("components", "home-service-search.tsx");
  const services = read("app", "services", "page.tsx");
  const sort = read("components", "sort-select.tsx");
  const filters = read("components", "service-filters-menu.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-search-input flex flex-1/);
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
