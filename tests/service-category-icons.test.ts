import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");
const categories = ["Home cleaning", "Car detailing", "Lawn & garden", "Handyman", "Photography", "Videography", "Pressure washing", "Furniture assembly", "House painting", "Pet care", "Moving help", "Junk removal", "Personal training", "Beauty & wellness", "Tutoring", "Tech help", "Event services", "Home repair", "Appliance repair", "Plumbing", "Electrical", "Graphic design", "Video editing", "Web development", "Writing & editing", "Digital marketing", "Virtual assistance", "Consulting", "Bookkeeping"];

test("every supported category has an explicit, unique icon", () => {
  const config = read("lib", "service-category-icons.ts");
  const iconNames = categories.map((category) => {
    const match = config.split("\n").find((line) => line.includes(`"${category}":`) || line.includes(`${category}:`))?.match(/icon: "([^"]+)"/);
    assert.ok(match, `${category} is explicitly mapped`);
    return match[1];
  });
  assert.equal(new Set(iconNames).size, categories.length);
  assert.match(config, /icon: "service"/);
});

test("category surfaces use the shared icon component instead of legacy artwork", () => {
  const surfaces = [
    ["app", "page.tsx"],
    ["app", "services", "page.tsx"],
    ["app", "locations", "[city]", "page.tsx"],
    ["app", "locations", "[city]", "[category]", "page.tsx"],
    ["app", "companies", "[slug]", "page.tsx"],
    ["app", "providers", "[slug]", "page.tsx"],
    ["components", "provider-dashboard.tsx"],
    ["components", "listing-photo-gallery.tsx"],
  ];
  for (const surface of surfaces) assert.match(read(...surface), /ServiceCategoryIcon/);
  assert.doesNotMatch(read("lib", "marketplace.ts"), /art:\s*["'`]/);
  assert.doesNotMatch(read("components", "provider-dashboard.tsx"), /🧰/);
});
