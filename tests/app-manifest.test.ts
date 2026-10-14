import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("BubsBookings provides installable app metadata and branded home screen icon", () => {
  const layout = read("app", "layout.tsx");
  const manifest = read("app", "manifest.ts");

  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(layout, /appleWebApp:/);
  assert.match(manifest, /name: "BubsBookings"/);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /src: "\/icon\.png"/);
  assert.match(manifest, /purpose: "maskable"/);
});
