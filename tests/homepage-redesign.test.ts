import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("redesigned homepage retains live marketplace search and listing data", () => {
  const home = read("app", "page.tsx");
  assert.match(home, /<HomeServiceSearch/);
  assert.match(home, /await getServices\(/);
  assert.match(home, /Homepage service loading failed/);
  assert.match(home, /return \[\]/);
  assert.match(home, /servicesWithinRange\.slice\(0, 6\)/);
  assert.match(home, /<FavoriteButton serviceId=\{service\.id\}/);
  assert.match(home, /service\.companySlug \? `\/companies\/\$\{service\.companySlug\}`/);
});

test("homepage categories use real searchable categories and preserve location context", () => {
  const home = read("app", "page.tsx");
  for (const category of ["Home repair", "Photography", "Tutoring", "Event services", "Pet care", "Consulting", "Tech help", "Home cleaning", "Handyman"]) {
    assert.match(home, new RegExp(`"${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(home, /categoryParams\.set\("location", location\)/);
  assert.match(home, /#service-listings/);
});

test("homepage category labels use matching category artwork", () => {
  const icons = read("lib", "service-category-icons.ts");
  const expectedMappings = [
    ["Home repair", "home-repair"],
    ["Photography", "camera"],
    ["Tutoring", "tutoring"],
    ["Event services", "event"],
    ["Pet care", "pet"],
    ["Consulting", "consulting"],
    ["Tech help", "tech"],
    ["Home cleaning", "cleaning"],
    ["Handyman", "handyman"],
  ];
  for (const [category, icon] of expectedMappings) {
    assert.match(icons, new RegExp(`(?:"${category}"|${category}): \\{ icon: "${icon}"`));
  }
});

test("homepage avoids invented statistics, testimonials, and guarantees", () => {
  const home = read("app", "page.tsx");
  assert.doesNotMatch(home, /1,500\+|10,000\+|50\+|What people are saying|testimonial/i);
  assert.doesNotMatch(home, /guaranteed customers|guaranteed bookings|workmanship guarantee/i);
  assert.match(home, /Why choose BubsBookings/);
  assert.match(home, /No lead fees/);
});

test("homepage hero uses a branded service panel instead of a decorative photo", () => {
  const preview = read("components", "home-hero-preview.tsx");
  assert.match(preview, /Explore BubsBookings/);
  assert.match(preview, /Find the right help for the job/);
  assert.doesNotMatch(preview, /next\/image|home-marketplace-hero\.webp/);
});

test("homepage hero category tiles are individual working links", () => {
  const preview = read("components", "home-hero-preview.tsx");
  const css = read("app", "globals.css");
  assert.match(preview, /href=\{categoryHref\(category\)\}/);
  assert.match(preview, /category=\$\{encodeURIComponent\(category\)\}/);
  assert.match(preview, /className="home-hero-explore-action"/);
  assert.doesNotMatch(preview, /className="home-hero-collage group/);
  assert.match(css, /\.home-hero-explore-action \{[^}]*color: #d7e3dc;/);
});

test("desktop navigation exposes pricing and clearly labels provider listing setup", () => {
  const home = read("app", "page.tsx");
  assert.match(home, /<Link href="\/pricing">Pricing<\/Link>/);
  assert.match(home, /<Link href="\/providers\/join">List Your Service<\/Link>/);
  assert.doesNotMatch(home, />For Providers<\/Link>/);
});

test("responsive homepage has deliberate tablet and phone layouts", () => {
  const css = read("app", "globals.css");
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*?\.home-hero-v2-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.home-redesign \.home-category-grid \{ display: flex/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*?\.home-popular-grid \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*?\.home-redesign \.home-service-card \{ grid-template-columns: minmax\(0, 1fr\)/);
});
