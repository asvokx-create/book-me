import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("About Us is a public, crawlable page with founder information", () => {
  const about = read("app", "about", "page.tsx");
  const layout = read("app", "layout.tsx");

  assert.match(about, /title = "About BubsBookings \| Founder Christian Talluto"/);
  assert.match(about, /pathname: "\/about"/);
  assert.match(about, /<h1[^>]*>Making Local Services Easier to Find and Book<\/h1>/);
  assert.match(about, /Christian Talluto/);
  assert.match(about, /Founder of BubsBookings/);
  assert.match(about, /"@type": "AboutPage"/);
  assert.match(layout, /founder: \{ "@type": "Person", name: "Christian Talluto", jobTitle: "Founder of BubsBookings" \}/);
});

test("About Us is linked in the public footer and sitemap", () => {
  assert.match(read("components", "site-footer.tsx"), /\["About Us", "\/about"\]/);
  assert.match(read("app", "sitemap.ts"), /"\/partners", "\/about", "\/locations"/);
});
