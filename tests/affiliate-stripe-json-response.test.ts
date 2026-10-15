import assert from "node:assert/strict";
import test from "node:test";
import { readJsonApiResponse } from "../lib/json-api-response.ts";

test("affiliate Stripe UI detects an HTML response without throwing a JSON parser error", async () => {
  const result = await readJsonApiResponse<{ url: string }>(new Response("<!DOCTYPE html><html><body>Sign in</body></html>", {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
  assert.equal(result.data, null);
  assert.match(result.error ?? "", /unexpected HTML response \(HTTP 503\)/);
});

test("affiliate Stripe UI reads application JSON normally", async () => {
  const result = await readJsonApiResponse<{ url: string }>(new Response(JSON.stringify({ url: "https://connect.stripe.com/setup" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
  assert.equal(result.error, null);
  assert.equal(result.data?.url, "https://connect.stripe.com/setup");
});
