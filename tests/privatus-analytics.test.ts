import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("Privatus Analytics is loaded once from the global root layout with the supplied configuration", () => {
  const layout = read("app", "layout.tsx");
  const nextConfig = read("next.config.ts");

  assert.equal((layout.match(/id="privatus-analytics"/g) ?? []).length, 1);
  assert.match(layout, /src="https:\/\/privatusanalytics\.com\/js\/pa\.js"/);
  assert.match(layout, /data-site="pa_QBY99J7UCK"/);
  assert.match(layout, /data-modules="engage,auto,vitals,clicks,ask"/);
  assert.match(layout, /strategy="beforeInteractive" defer/);
  assert.match(nextConfig, /script-src[^\n]*https:\/\/privatusanalytics\.com/);
  assert.match(nextConfig, /connect-src[^\n]*https:\/\/privatusanalytics\.com/);
});

test("privacy disclosures distinguish Privatus cookie-free measurement from cookie-based analytics", () => {
  const privacy = read("app", "privacy", "page.tsx");
  const cookies = read("app", "cookies", "page.tsx");

  assert.match(privacy, /Privatus Analytics for cookie-free website measurement/);
  assert.match(privacy, /does not use cookies/);
  assert.match(cookies, /Privatus Analytics for cookie-free measurement/);
  assert.match(cookies, /not enabled or disabled through Cookie choices/);
});
