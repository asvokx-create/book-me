import assert from "node:assert/strict";
import test from "node:test";

import { getGoogleSignInErrorMessage } from "../lib/oauth-error.ts";

test("explains when a Google email needs a new BubsBookings account", () => {
  assert.match(getGoogleSignInErrorMessage("signup_disabled"), /Create an account with Google first/);
});

test("provides a useful fallback for unknown OAuth errors", () => {
  assert.equal(getGoogleSignInErrorMessage("unexpected_error", "Google temporarily refused the request."), "Google temporarily refused the request.");
  assert.match(getGoogleSignInErrorMessage("unexpected_error"), /Google sign-in could not be completed/);
});
