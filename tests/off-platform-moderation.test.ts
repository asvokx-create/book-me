import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { assessOffPlatformMessage, type MessageBookingContext } from "../lib/off-platform-moderation.ts";

const none: MessageBookingContext = { bookingId: null, state: "none", quoteStatus: null, bookingStatus: null, paymentStatus: null };
const paid: MessageBookingContext = { bookingId: "booking-1", state: "paid", quoteStatus: "accepted", bookingStatus: "confirmed", paymentStatus: "paid" };

test("clear fee and payment circumvention is high risk and blocked", () => {
  for (const message of [
    "Cancel this and Venmo me instead.",
    "Pay me directly and I'll give you a cheaper price.",
    "Don't book through BubsBookings.",
    "Text me and we can avoid the fee.",
    "c a s h a p p me instead and cancel the booking",
    "Here is my personal number (425) 555-0199, just pay me directly",
  ]) {
    const result = assessOffPlatformMessage(message, none);
    assert.equal(result.riskLevel, "high", message);
    assert.equal(result.blocked, true, message);
  }
});

test("pre-booking payment and contact redirects are blocked", () => {
  for (const message of [
    "Do you accept v e n m o?",
    "DM me on IG @cleaner and we can set it up",
    "Text me at (425) 555-0199 instead",
    "Contact me at hello@example.com instead",
    "Book at example.com instead",
    "Zelle me directly",
    "PayPal me directly",
    "Text me instead",
    "Contact me through my website",
  ]) {
    const result = assessOffPlatformMessage(message, none);
    assert.ok(["medium", "high"].includes(result.riskLevel), message);
    assert.equal(result.blocked, true, message);
  }
});

test("booked logistics and ordinary conversation remain deliverable", () => {
  for (const message of [
    "Here is my number (425) 555-0199 in case you cannot find the house.",
    "The gate code is 1938 and parking is on the left.",
    "The service address is 100 Main Street, unit 4.",
    "Here is the manufacturer guide https://example.com/manual.pdf",
    "I sent the refund back to your Venmo because support instructed me to.",
  ]) {
    const result = assessOffPlatformMessage(message, paid);
    assert.equal(result.blocked, false, message);
    if (/find the house|gate code|service address/.test(message.toLowerCase())) assert.equal(result.riskLevel, "none", message);
  }
  assert.equal(assessOffPlatformMessage("Is Tuesday afternoon available?", none).riskLevel, "none");
});

test("obfuscated contact information is detected without treating all contact as fraud", () => {
  assert.notEqual(assessOffPlatformMessage("text me at 4 2 5 - 5 5 5 - 0 1 9 9 instead", none).riskLevel, "none");
  assert.notEqual(assessOffPlatformMessage("my number is four two five five five five zero one nine nine", none).riskLevel, "none");
  assert.equal(assessOffPlatformMessage("My gate code is 1938", paid).riskLevel, "none");
});

test("ambiguous standalone contact and harmless links are logged but delivered", () => {
  for (const message of ["My number is (425) 555-0199", "My email is hello@example.com", "The manual is at https://example.com/manual.pdf"]) {
    const result = assessOffPlatformMessage(message, none);
    assert.equal(result.riskLevel, "low", message);
    assert.equal(result.blocked, false, message);
  }
});

test("enforcement architecture is server-side, contextual, idempotent, and admin-only", async () => {
  const route = await readFile(new URL("../app/api/messages/route.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../database/migrations/075_off_platform_message_moderation.sql", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8");
  const accountExport = await readFile(new URL("../app/api/account/data-export/route.ts", import.meta.url), "utf8");
  const adminUi = await readFile(new URL("../components/admin-dashboard.tsx", import.meta.url), "utf8");
  const terms = await readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
  assert.match(route, /assessOffPlatformMessage/);
  assert.match(route, /booking_context|bookingContext/);
  assert.match(route, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
  assert.match(route, /clientMessageId/);
  assert.match(migration, /message_moderation_events/);
  assert.match(migration, /under_review/);
  assert.match(admin, /getAdminSession/);
  assert.match(admin, /message_moderation_status/);
  assert.match(admin, /account_review_cleared/);
  assert.match(adminUi, /Off-platform message review/);
  for (const filter of ["low", "medium", "high", "open", "resolved", "false_positive", "under_review", "suspended", "banned"]) assert.match(adminUi, new RegExp(`value="${filter}"`));
  assert.doesNotMatch(accountExport, /moderationEvents/);
  assert.match(terms, /intentionally move the resulting booking, transaction, or payment outside BubsBookings/);
  assert.match(privacy, /Humans do not continuously read every conversation/);
});
