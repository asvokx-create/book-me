import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

test("homepage radius uses the shared custom dropdown and redundant online shortcut is removed", () => {
  const radius = read("components", "radius-selector.tsx");
  const home = read("app", "page.tsx");
  assert.match(radius, /<CustomSelect/);
  assert.doesNotMatch(radius, /<select/);
  assert.doesNotMatch(home, /Browse services available online/);
});

test("customer service requests keep one primary creation action and never expose JSON parser errors", () => {
  const center = read("components", "job-request-center.tsx");
  const route = read("app", "api", "job-requests", "route.ts");
  assert.match(center, /async function readJsonResponse/);
  assert.doesNotMatch(center, /Unexpected end of JSON input/);
  assert.match(center, /Use the yellow button above/);
  assert.doesNotMatch(center, /mode === "customer" && <Link href="\/requests" className="mt-5/);
  assert.match(route, /Service request loading failed/);
  assert.match(route, /NextResponse\.json\(\{ error: "Service requests are temporarily unavailable/);
});
