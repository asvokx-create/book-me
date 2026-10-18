import assert from "node:assert/strict";
import test from "node:test";
import { hasTrustedRequestOrigin } from "../lib/request-origin.ts";

test("accepts a direct same-origin request", () => {
  const request = new Request("https://bubsbookings.com/api/admin/jarvis", {
    headers: { origin: "https://bubsbookings.com" },
  });
  assert.equal(hasTrustedRequestOrigin(request), true);
});

test("accepts the public origin behind a TLS-terminating proxy", () => {
  const request = new Request("http://10.20.0.4:8080/api/admin/jarvis", {
    headers: {
      origin: "https://bubsbookings.com",
      host: "10.20.0.4:8080",
      "x-forwarded-host": "bubsbookings.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(hasTrustedRequestOrigin(request), true);
});

test("rejects a cross-site origin", () => {
  const request = new Request("http://10.20.0.4:8080/api/admin/jarvis", {
    headers: {
      origin: "https://attacker.example",
      "x-forwarded-host": "bubsbookings.com",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(hasTrustedRequestOrigin(request), false);
});

test("rejects requests without a browser Origin header", () => {
  const request = new Request("https://bubsbookings.com/api/admin/jarvis");
  assert.equal(hasTrustedRequestOrigin(request), false);
});
