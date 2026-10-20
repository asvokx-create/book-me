import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { shouldRecordAffiliateLanding } from "../lib/affiliate-request.ts";

function request(input: { method?: string; url?: string; headers?: Record<string, string> } = {}) {
  return {
    method: input.method ?? "GET",
    url: input.url ?? "https://bubsbookings.com/providers/join?ref=PRESTONLEE&utm_source=affiliate",
    headers: new Headers(input.headers),
  };
}

test("direct and mobile referral documents are eligible for server-side recording", () => {
  assert.equal(shouldRecordAffiliateLanding(request({ headers: { "sec-fetch-dest": "document", "user-agent": "Mozilla/5.0 Safari/605.1.15 iPhone" } })), true);
  assert.equal(shouldRecordAffiliateLanding(request({ headers: { "sec-fetch-dest": "document", "user-agent": "Mozilla/5.0 Chrome/140.0 Mobile Safari/537.36" } })), true);
});

test("prefetches, bots, non-documents, invalid paths, and non-GET requests are excluded", () => {
  assert.equal(shouldRecordAffiliateLanding(request({ headers: { purpose: "prefetch" } })), false);
  assert.equal(shouldRecordAffiliateLanding(request({ headers: { "user-agent": "Googlebot/2.1" } })), false);
  assert.equal(shouldRecordAffiliateLanding(request({ headers: { "sec-fetch-dest": "script" } })), false);
  assert.equal(shouldRecordAffiliateLanding(request({ url: "https://bubsbookings.com/providers/join" })), false);
  assert.equal(shouldRecordAffiliateLanding(request({ url: "https://bubsbookings.com/pricing?ref=PRESTONLEE" })), false);
  assert.equal(shouldRecordAffiliateLanding(request({ method: "POST" })), false);
});

test("initial referral attribution is recorded before client JavaScript and retains first touch", async () => {
  const proxy = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
  const store = await readFile(new URL("../lib/affiliate-attribution-store.ts", import.meta.url), "utf8");
  const clientTracker = await readFile(new URL("../components/affiliate-attribution-tracker.tsx", import.meta.url), "utf8");
  assert.match(proxy, /shouldRecordAffiliateLanding\(request\)/);
  assert.match(proxy, /storeAffiliateAttribution/);
  assert.match(proxy, /matcher: \["\/api\/:path\*", "\/providers\/join"\]/);
  assert.ok(store.indexOf('status: "retained"') < store.indexOf("INSERT INTO affiliate_clicks"));
  assert.match(store, /affiliate\.status = 'active'/);
  assert.match(store, /program\.status = 'enabled'/);
  assert.match(clientTracker, /fetch\("\/api\/affiliates\/attribution"/);
  assert.doesNotMatch(clientTracker, /useAnalyticsConsent/);
});
