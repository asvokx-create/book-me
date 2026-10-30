import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("premium homepage retains live marketplace search and eligible listing data", () => {
  const home = read("app", "page.tsx");
  assert.match(home, /<HomeServiceSearch/);
  assert.match(home, /await getServices\(/);
  assert.match(home, /Homepage service loading failed/);
  assert.match(home, /servicesWithinRange\.slice\(0, 4\)/);
  assert.match(home, /<FavoriteButton serviceId=\{service\.id\}/);
  assert.match(home, /service\.companySlug \? `\/companies\/\$\{service\.companySlug\}`/);
  assert.doesNotMatch(home, /1,500\+|10,000\+|50\+|testimonial|guaranteed customers|guaranteed bookings/i);
});

test("premium hero uses an optimized people-free local asset and one search surface", () => {
  const home = read("app", "page.tsx");
  assert.ok(existsSync(join(root, "public", "images", "home-premium-hero.webp")));
  assert.match(home, /src="\/images\/home-premium-hero\.webp"/);
  assert.match(home, /alt="Modern lakeside home overlooking a mountain landscape"/);
  assert.equal((home.match(/<HomeServiceSearch/g) ?? []).length, 1);
  assert.match(home, /Get things <span>done\.<\/span>/);
});

test("homepage categories use supported searchable values and preserve location", () => {
  const home = read("app", "page.tsx");
  for (const category of ["Home repair", "Car detailing", "Tech help", "Photography", "Personal training", "Pet care", "Tutoring"]) {
    assert.match(home, new RegExp(`category: "${category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.match(home, /categoryParams\.set\("location", location\)/);
  assert.match(home, /#service-listings/);
});

test("homepage has the focused seven-section structure and truthful provider promo", () => {
  const home = read("app", "page.tsx");
  const showcase = read("components", "home-provider-showcase.tsx");
  for (const className of ["premium-hero", "premium-categories", "premium-featured", "premium-how", "premium-provider"]) {
    assert.match(home, new RegExp(`className="${className}(?: |")`));
  }
  assert.match(home, /without paying for leads/);
  assert.match(showcase, /Illustrative preview/);
  assert.doesNotMatch(home, /home-benefit-band|home-why|home-final-links|What people are saying/);
});

test("desktop navigation matches the premium public information architecture", () => {
  const home = read("app", "page.tsx");
  assert.match(home, />Find a Service<\/Link>/);
  assert.match(home, />For Providers<\/Link>/);
  assert.match(home, />How It Works<\/Link>/);
  assert.match(home, />Resources<\/Link>/);
  assert.match(home, /aria-label="Search services"/);
});

test("homepage header keeps its first server and client render stable", () => {
  const accountNav = read("components", "account-nav.tsx");
  const brandMark = read("components", "brand-mark.tsx");
  assert.match(accountNav, /const mounted = useSyncExternalStore/);
  assert.match(accountNav, /if \(!mounted \|\| isPending\)/);
  assert.match(brandMark, /loading=\{priority \? "eager" : "lazy"\}/);
});

test("responsive homepage has deliberate tablet and phone layouts", () => {
  const css = read("app", "globals.css");
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*?\.premium-provider-inner \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.premium-category-row \{ display: flex/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*?\.premium-listing-grid \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(max-width: 359px\)[\s\S]*?\.premium-service-card \{ grid-template-columns: 1fr/);
});
