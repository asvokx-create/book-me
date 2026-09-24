import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("shared layout tokens cap reading, content, marketplace, and dashboard widths", () => {
  const css = read("app", "globals.css");

  for (const token of ["--layout-reading", "--layout-content", "--layout-wide", "--layout-dashboard", "--layout-gutter"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(css, /\.site-container \{ max-width: var\(--layout-content\); \}/);
  assert.match(css, /\.site-container-wide \{ max-width: var\(--layout-wide\); \}/);
  assert.match(css, /\.dashboard-container \{ max-width: var\(--layout-dashboard\); \}/);
  assert.match(css, /\.reading-measure \{ max-width: 72ch; \}/);
});

test("large displays gain useful columns without allowing cards and booking panels to stretch", () => {
  const home = read("app", "page.tsx");
  const services = read("app", "services", "page.tsx");
  const listing = read("app", "services", "[slug]", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(home, /min-\[1536px\]:grid-cols-4/);
  assert.match(services, /min-\[1536px\]:grid-cols-4/);
  assert.match(listing, /minmax\(20rem,25rem\)/);
  assert.match(listing, /service-booking-column/);
  assert.match(css, /\.service-booking-column[\s\S]*?max-width: 25rem/);
});

test("application shells and messages use bounded wide-screen layouts", () => {
  const account = read("app", "account", "page.tsx");
  const admin = read("components", "admin-dashboard.tsx");
  const provider = read("components", "provider-dashboard.tsx");
  const messages = read("components", "messaging-center.tsx");
  const css = read("app", "globals.css");

  assert.match(account, /dashboard-container/);
  assert.match(admin, /dashboard-container/);
  assert.match(provider, /dashboard-shell dashboard-container/);
  assert.match(messages, /message-bubble/);
  assert.match(css, /max-width: min\(82%, 44rem\)/);
});

test("the global responsive system preserves mobile viewport safety", () => {
  const css = read("app", "globals.css");
  const layout = read("app", "layout.tsx");

  assert.match(css, /overflow-x: clip/);
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(layout, /user-scalable=no/);
});
