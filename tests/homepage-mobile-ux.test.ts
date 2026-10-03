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
  assert.match(css, /\.home-search-location > div \{ flex-direction: row/);
});

test("phone homepage removes desktop bulk before discovery", () => {
  const home = read("app", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /home-header-account/);
  assert.match(home, /home-category-grid/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.home-header-account \{ display: none; \}/);
  assert.match(css, /\.home-hero-points > span:nth-child\(n\+2\) \{ display: none; \}/);
  assert.match(css, /\.home-request-banner \{ display: none !important; \}/);
  assert.match(css, /\.home-discovery \{[\s\S]*?padding-top: 1\.8rem/);
});

test("mobile category and listing grids cannot force horizontal overflow", () => {
  const css = read("app", "globals.css");
  const icon = read("components", "service-category-icon.tsx");

  assert.match(css, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 9\.5rem\), 1fr\)\)/);
  assert.match(css, /\.home-category-card \{[\s\S]*?grid-template-columns: 2\.5rem minmax\(0, 1fr\)/);
  assert.match(css, /\.home-service-card \{[\s\S]*?grid-template-columns: 7\.25rem minmax\(0, 1fr\)/);
  assert.match(icon, /shrink-0[\s\S]*?aspect-square/);
  assert.doesNotMatch(css, /\.home-(?:category|service)-card[^}]*width:\s*100vw/);
});

test("homepage listing photos reserve their layout and lazy-load below the fold", () => {
  const home = read("app", "page.tsx");
  assert.match(home, /<Image src=\{service\.imageUrls\[0\]\}/);
  assert.match(home, /fill loading="lazy" unoptimized sizes="\(max-width: 639px\) 116px/);
  assert.match(home, /className="object-cover"/);
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
