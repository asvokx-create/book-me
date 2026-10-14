import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public rate-limit keys use DigitalOcean's trusted client IP and do not trust production forwarding headers", async () => {
  const security = await readFile(new URL("../lib/request-security.ts", import.meta.url), "utf8");
  assert.match(security, /function publicRequestRateLimitKey/);
  assert.match(security, /do-connecting-ip/);
  assert.match(security, /NODE_ENV !== "production"/);
  assert.match(security, /return "ip:unavailable"/);
});

test("public demand and referral routes have a server-side connection limit", async () => {
  const demand = await readFile(new URL("../app/api/service-demand/route.ts", import.meta.url), "utf8");
  const attribution = await readFile(new URL("../app/api/affiliates/attribution/route.ts", import.meta.url), "utf8");
  assert.match(demand, /publicRequestRateLimitKey\(request\)/);
  assert.match(demand, /bucket: "service-demand-ip", limit: 10, windowSeconds: 3600/);
  assert.match(attribution, /publicRequestRateLimitKey\(request\)/);
  assert.doesNotMatch(attribution, /request\.headers\.get\("x-forwarded-for"\)/);
});
