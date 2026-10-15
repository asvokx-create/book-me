import assert from "node:assert/strict";
import test from "node:test";
import { extractPublicBusinessEmails, publicContactPageUrls } from "../lib/public-contact-discovery.ts";

test("public email extraction ignores script vendors and prefers a business-domain email", () => {
  const emails = extractPublicBusinessEmails(`
    <script>const vendor = "support@analytics-vendor.example";</script>
    <a href="mailto:hello@evergreen.example">Email us</a>
    <p>Owner: christian@personal-mail.example</p>
    <p>Questions? info&#64;evergreen.example</p>
  `, "www.evergreen.example");

  assert.deepEqual(emails, ["hello@evergreen.example", "info@evergreen.example", "christian@personal-mail.example"]);
});

test("contact-page selection stays on the business website", () => {
  const source = new URL("https://www.evergreen.example/");
  const pages = publicContactPageUrls(`
    <a href="/contact">Contact</a>
    <a href="https://evergreen.example/about-us">About us</a>
    <a href="https://outside.example/contact">External contact</a>
  `, source);

  assert.deepEqual(pages.map((page) => page.toString()), [
    "https://www.evergreen.example/contact",
    "https://evergreen.example/about-us",
  ]);
});
