import assert from "node:assert/strict";
import test from "node:test";

const { resolvePayoutReleasesUrl, triggerPaymentReleases, triggerScheduledOperations } = await import("../lib/payout-cron-trigger.mjs");

test("payout scheduler targets only the protected payment release endpoint", () => {
  const url = resolvePayoutReleasesUrl("https://bubsbookings.com");
  assert.equal(url.href, "https://bubsbookings.com/api/cron/payment-releases");
  assert.throws(() => resolvePayoutReleasesUrl("https://bubsbookings.com/untrusted"));
  assert.throws(() => resolvePayoutReleasesUrl("http://bubsbookings.com"));
});

test("payout scheduler sends the cron secret and accepts only a confirmed JSON result", async () => {
  let request: Request | undefined;
  const result = await triggerPaymentReleases({
    origin: "https://bubsbookings.com",
    secret: "test-secret",
    fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ ok: true, released: 0 }), {
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal(request?.url, "https://bubsbookings.com/api/cron/payment-releases");
  assert.equal(request?.method, "POST");
  assert.equal(request?.headers.get("authorization"), "Bearer test-secret");
  assert.deepEqual(result, { ok: true, released: 0 });
});

test("payout scheduler fails clearly on an HTML response or an unsuccessful payload", async () => {
  await assert.rejects(
    triggerPaymentReleases({
      origin: "https://bubsbookings.com",
      secret: "test-secret",
      fetchImpl: async () => new Response("<!doctype html>", { status: 502, headers: { "content-type": "text/html" } }),
    }),
    /non-JSON response/,
  );
  await assert.rejects(
    triggerPaymentReleases({
      origin: "https://bubsbookings.com",
      secret: "test-secret",
      fetchImpl: async () => new Response(JSON.stringify({ ok: false }), { headers: { "content-type": "application/json" } }),
    }),
    /did not confirm a successful run/,
  );
});

test("the single scheduled job runs payouts, reminders, Jarvis checks, and provider welcome retries", async () => {
  const requestedPaths: string[] = [];
  const result = await triggerScheduledOperations({
    origin: "https://bubsbookings.com",
    secret: "test-secret",
    fetchImpl: async (input: RequestInfo | URL) => {
      requestedPaths.push(new URL(String(input)).pathname);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    },
  });

  assert.deepEqual(requestedPaths, ["/api/cron/payment-releases", "/api/cron/booking-reminders", "/api/cron/jarvis-incidents", "/api/cron/provider-welcome-emails"]);
  assert.deepEqual(result, { paymentReleases: { ok: true }, bookingReminders: { ok: true }, jarvisIncidents: { ok: true }, providerWelcomeEmails: { ok: true } });
});
