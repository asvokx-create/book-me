import assert from "node:assert/strict";
import test from "node:test";
import { getMobileNavigationState } from "../lib/mobile-navigation-state.ts";

test("auth loading never renders logged-out actions", () => {
  const state = getMobileNavigationState({ isPending: true, authenticated: false });
  assert.equal(state.status, "loading");
  assert.equal(state.showLogin, false);
  assert.equal(state.showCreateAccount, false);
});

test("logged-out navigation renders login and account creation", () => {
  const state = getMobileNavigationState({ isPending: false, authenticated: false });
  assert.equal(state.showLogin, true);
  assert.equal(state.showCreateAccount, true);
  assert.equal(state.showAccount, false);
  assert.equal(state.showLogout, false);
});

test("logged-in customer navigation replaces login with account and logout", () => {
  const state = getMobileNavigationState({ isPending: false, authenticated: true, role: "customer" });
  assert.equal(state.showLogin, false);
  assert.equal(state.showCreateAccount, false);
  assert.equal(state.showAccount, true);
  assert.equal(state.showLogout, true);
  assert.equal(state.showProviderDashboard, false);
});

test("logged-in provider navigation includes the provider dashboard", () => {
  const state = getMobileNavigationState({ isPending: false, authenticated: true, role: "provider" });
  assert.equal(state.showProviderDashboard, true);
  assert.equal(state.showLogin, false);
});

test("logged-in admin navigation includes the admin dashboard", () => {
  const state = getMobileNavigationState({ isPending: false, authenticated: true, role: "customer", isAdmin: true });
  assert.equal(state.showAdminDashboard, true);
  assert.equal(state.showLogin, false);
});

test("session transitions update mobile navigation without a reload", () => {
  const loggedOut = getMobileNavigationState({ isPending: false, authenticated: false });
  const loggedIn = getMobileNavigationState({ isPending: false, authenticated: true, role: "customer" });
  const signedOutAgain = getMobileNavigationState({ isPending: false, authenticated: false });

  assert.equal(loggedOut.showLogin, true);
  assert.equal(loggedIn.showLogin, false);
  assert.equal(loggedIn.showAccount, true);
  assert.equal(signedOutAgain.showLogin, true);
});
