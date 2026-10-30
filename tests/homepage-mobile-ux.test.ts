import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("homepage search exposes a compact accessible delivery control on phones", () => {
  const search = read("components", "home-service-search.tsx");
  const css = read("app", "globals.css");

  assert.match(search, /type="hidden" name="delivery" value=\{delivery\}/);
  assert.match(search, /role="group" aria-label="Service delivery type"/);
  assert.match(search, /aria-pressed=\{delivery === option\}/);
  assert.match(css, /\.home-search-delivery-mobile[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.home-search-location \.location-filter \{ flex-direction: column/);
  assert.match(css, /\.home-search-location \.location-filter-radius \{ width: 100%/);
});

test("homepage search prompt keeps the remaining width beside its icon", () => {
  const search = read("components", "home-service-search.tsx");
  assert.match(search, /className="home-search-input flex min-w-0 flex-1/);
  assert.match(search, /inputClassName="min-w-0 flex-1/);
  assert.doesNotMatch(search, /inputClassName="w-full/);
});

test("homepage search overlays discovery content and uses single-surface filters", () => {
  const css = read("app", "globals.css");

  assert.match(css, /\.home-redesign > \.home-hero-v2 \{ position: relative; z-index: 100; overflow: visible; animation: none; transform: none;/);
  assert.match(css, /\.home-search-dock \{ position: relative; z-index: 40;/);
  assert.match(css, /\.home-search-dock \.home-search-bar \{ z-index: 50;/);
  assert.match(css, /\.home-redesign > \.home-discovery \{ position: relative; z-index: 0; animation: none; transform: none;/);
  assert.match(css, /\.home-search-delivery \.custom-select-trigger,[\s\S]*?\.location-filter-radius \.custom-select-trigger \{[\s\S]*?border: 0 !important;[\s\S]*?background: transparent !important;/);
});

test("hero browse action stays visually prominent and clear of the search panel", () => {
  const preview = read("components", "home-hero-preview.tsx");
  const css = read("app", "globals.css");

  assert.match(preview, /className="home-hero-explore-action"/);
  assert.match(css, /\.home-hero-explore-action \{[^}]*background: #123d2e;[^}]*color: #d7e3dc;/);
  assert.match(css, /\.home-search-dock \{[^}]*margin-top: 1rem;/);
  assert.doesNotMatch(css, /\.home-search-dock \{[^}]*margin-top: -/);
});

test("phone homepage keeps the hero focused and categories horizontally usable", () => {
  const home = read("app", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-header-account/);
  assert.match(home, /premium-category-row/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.premium-home-header \.home-header-account \{ display: none; \}/);
  assert.match(css, /\.premium-category-row \{ display: flex;[\s\S]*?overflow-x: auto/);
  assert.doesNotMatch(home, /home-benefit-band|home-request-banner/);
});

test("mobile category and listing layouts cannot force horizontal overflow", () => {
  const css = read("app", "globals.css");
  const icon = read("components", "service-category-icon.tsx");

  assert.match(css, /\.premium-category-row \{[\s\S]*?overflow-x: auto/);
  assert.match(css, /\.premium-category-link \{[\s\S]*?min-width: 5\.85rem/);
  assert.match(css, /\.premium-service-card \{[\s\S]*?grid-template-columns: minmax\(7rem, 38%\) 1fr/);
  assert.match(css, /\.premium-service-content h3 \{[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal;/);
  assert.match(icon, /shrink-0[\s\S]*?aspect-square/);
  assert.doesNotMatch(css, /\.premium-(?:category|service)-[^}]*width:\s*100vw/);
});

test("homepage listing photos reserve their layout and lazy-load below the fold", () => {
  const card = read("components", "service-listing-card.tsx");
  assert.match(card, /<Image src=\{imageUrl\}/);
  assert.match(card, /fill loading="lazy" unoptimized sizes="\(max-width: 639px\) calc\(100vw - 32px\)/);
  assert.match(card, /className="object-cover"/);
});

test("mobile listing cards keep long titles and prices readable", () => {
  const card = read("components", "service-listing-card.tsx");
  const companies = read("app", "companies", "[slug]", "page.tsx");
  const favorites = read("app", "account", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(card, /premium-service-content/);
  assert.match(card, /premium-service-price/);
  assert.doesNotMatch(card, /<h3 className="[^"]*truncate[^"]*">\{service\.title\}<\/h3>/);
  assert.match(companies, /ServiceListingCard/);
  assert.match(favorites, /ServiceListingCard/);
  assert.match(css, /\.listing-card-meta,[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.listing-card-title,[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal/);
  assert.match(css, /\.premium-service-content h3 \{[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal;/);
  assert.doesNotMatch(css, /body\s*\{\s*overflow-wrap:\s*anywhere/);
});

test("mobile navigation traps focus and returns it to its labelled trigger", () => {
  const nav = read("components", "mobile-site-nav.tsx");
  assert.match(nav, /aria-controls="mobile-site-navigation"/);
  assert.match(nav, /role="dialog" aria-modal="true"/);
  assert.match(nav, /siteContent\.inert = true/);
  assert.match(nav, /event\.key !== "Tab"/);
  assert.match(nav, /const triggerButton = triggerButtonRef\.current/);
  assert.match(nav, /triggerButton\?\.focus\(\)/);
});

test("mobile footer link groups are collapsed without hiding desktop navigation", () => {
  const footer = read("components", "site-footer.tsx");
  const css = read("app", "globals.css");
  assert.match(footer, /site-footer-mobile-group/);
  assert.match(footer, /site-footer-desktop-group/);
  assert.match(css, /\.site-footer-mobile-group \{ display: block/);
  assert.match(css, /\.site-footer-desktop-group \{ display: none/);
});
