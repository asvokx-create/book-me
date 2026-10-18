import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("footer includes the authorized SaaS Browser verification badge", () => {
  const source = readFileSync(new URL("../components/site-footer.tsx", import.meta.url), "utf8");

  assert.match(source, /href="https:\/\/saasbrowser\.com\/en\/saas\/1712492\/bubsbookings"/);
  assert.match(source, /rel="nofollow noopener"/);
  assert.match(source, /alt="BubsBookings - SaaS Browser Verified Badge" width="200" height="133"/);
});
