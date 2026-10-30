import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidSearchRadius, MAX_SEARCH_RADIUS_MILES, normalizeSearchRadius } from "../lib/search-radius.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("custom marketplace distance supports searches beyond 250 miles", () => {
  assert.equal(isValidSearchRadius(251), true);
  assert.equal(isValidSearchRadius(3_000), true);
  assert.equal(normalizeSearchRadius(3_000), 3_000);
  assert.equal(isValidSearchRadius(MAX_SEARCH_RADIUS_MILES + 1), false);
  assert.equal(normalizeSearchRadius(MAX_SEARCH_RADIUS_MILES + 1), 25);
});

test("homepage marketplace uses the shared custom search limit", () => {
  const homepage = source("app/page.tsx");
  const locationFilter = source("components/location-filter.tsx");
  const marketplace = source("lib/marketplace.ts");

  assert.match(homepage, /normalizeSearchRadius\(requestedRadius\)/);
  assert.match(locationFilter, /max=\{MAX_SEARCH_RADIUS_MILES\}/);
  assert.match(locationFilter, /isValidSearchRadius\(nextRadius\)/);
  assert.match(marketplace, /MAX_SEARCH_RADIUS_MILES/);
  assert.doesNotMatch(marketplace, /Math\.min\(Math\.max\(options\.radiusMiles, 1\), 250\)/);
});

test("provider travel radius keeps its separate 250-mile safety limit", () => {
  const providerRoute = source("app/api/providers/trust-settings/route.ts");
  const locationRoute = source("app/api/providers/locations/route.ts");

  assert.match(providerRoute, /serviceRadiusMiles > 250/);
  assert.match(locationRoute, /radius > 250/);
});
