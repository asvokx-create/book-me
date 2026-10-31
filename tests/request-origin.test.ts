import assert from "node:assert/strict";
import test from "node:test";
import { hasTrustedRequestOrigin, publicRequestOrigin } from "../lib/request-origin.ts";

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

test("public redirects prefer the configured application URL over an internal proxy URL", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://bubsbookings.com";
  try {
    const request = new Request("https://localhost:8080/api/integrations/calendly/callback");
    assert.equal(publicRequestOrigin(request), "https://bubsbookings.com");
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  }
});

test("public redirects use forwarded host and protocol without a canonical URL", () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const authUrl = process.env.BETTER_AUTH_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.BETTER_AUTH_URL;
  try {
    const request = new Request("http://localhost:8080/callback", {
      headers: { "x-forwarded-host": "bubsbookings.com", "x-forwarded-proto": "https" },
    });
    assert.equal(publicRequestOrigin(request), "https://bubsbookings.com");
  } finally {
    if (appUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = appUrl;
    if (authUrl !== undefined) process.env.BETTER_AUTH_URL = authUrl;
  }
});
