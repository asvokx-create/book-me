import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("fallback category artwork stays positioned inside the listing gallery", () => {
  const source = readFileSync(new URL("../components/listing-photo-gallery.tsx", import.meta.url), "utf8");

  assert.match(source, /className="!absolute bottom-8 right-10/);
});
