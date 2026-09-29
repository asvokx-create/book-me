import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("live marketplace directories and the sitemap are request-time rendered", () => {
  assert.match(read("app", "locations", "page.tsx"), /export const dynamic = "force-dynamic"/);
  assert.match(read("app", "sitemap.ts"), /export const dynamic = "force-dynamic"/);
});

test("sitewide support controls have durable internal destinations", () => {
  const footer = read("components", "site-footer.tsx");
  const bugReport = read("components", "bug-report-button.tsx");
  const supportButton = read("components", "contact-support-button.tsx");
  const supportPage = read("app", "support", "page.tsx");

  assert.doesNotMatch(footer, /mailto:christian@bubsbookings\.com/);
  assert.match(footer, /\["Contact support", "\/support"\]/);
  assert.match(bugReport, /href="\/support\?topic=bug"/);
  assert.match(supportButton, /href="\/support"/);
  assert.match(supportPage, /<ContactSupportButton/);
  assert.match(supportPage, /Log in to contact support/);
  assert.match(supportPage, /Email instead/);
});

test("provider-intent authentication keeps provider context", () => {
  const authForm = read("app", "auth-form.tsx");
  assert.match(authForm, /isProviderIntent/);
  assert.match(authForm, /Create your provider account/);
  assert.match(authForm, /Log in to continue provider setup/);
  assert.match(authForm, /services, availability, and Stripe payouts/);
});

test("zero-result discovery prioritizes the existing service-request workflow", () => {
  const services = read("app", "services", "page.tsx");
  assert.match(services, /href=\{`\/requests\?\$\{new URLSearchParams/);
  assert.match(services, /Request this service/);
  assert.match(services, /category: selectedCategory/);
  assert.match(services, /title: query/);
  assert.match(services, /Expand to 50 miles/);
  assert.match(services, /<ServiceDemandCapture/);
});

test("the Guides index keeps a complete social preview", () => {
  const guides = read("app", "guides", "page.tsx");
  assert.match(guides, /openGraph:[\s\S]*images: \[\{ url: "\/brand-logo\.png"/);
  assert.match(guides, /twitter: \{ card: "summary"/);
});
