import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  extraSeatMonthlyCents,
  minimumExtraSeatsForWorkers,
  proMonthlyTotalCents,
  subscriptionProvidesProAccess,
  totalTeamSeats,
} from "../lib/team-seat-rules.ts";

test("Pro includes the owner and two workers before paid seats", () => {
  assert.equal(totalTeamSeats("starter", 8), 1);
  assert.equal(totalTeamSeats("pro", 0), 3);
  assert.equal(totalTeamSeats("pro", 1), 4);
  assert.equal(totalTeamSeats("pro", 5), 8);
  assert.equal(totalTeamSeats("business", 0), null);
});

test("extra seats cost exactly 50 cents each", () => {
  assert.equal(extraSeatMonthlyCents(0), 0);
  assert.equal(extraSeatMonthlyCents(1), 50);
  assert.equal(extraSeatMonthlyCents(2), 100);
  assert.equal(extraSeatMonthlyCents(5), 250);
});

test("Pro recurring totals match the published examples", () => {
  assert.equal(proMonthlyTotalCents(0), 999);
  assert.equal(proMonthlyTotalCents(1), 1049);
  assert.equal(proMonthlyTotalCents(2), 1099);
  assert.equal(proMonthlyTotalCents(5), 1249);
});

test("active workers and pending invitations both determine the safe minimum", () => {
  assert.equal(minimumExtraSeatsForWorkers(0), 0);
  assert.equal(minimumExtraSeatsForWorkers(2), 0);
  assert.equal(minimumExtraSeatsForWorkers(3), 1);
  assert.equal(minimumExtraSeatsForWorkers(6), 4);
});

test("past-due subscriptions keep Pro during Stripe's payment retry grace", () => {
  assert.equal(subscriptionProvidesProAccess("active"), true);
  assert.equal(subscriptionProvidesProAccess("trialing"), true);
  assert.equal(subscriptionProvidesProAccess("past_due"), true);
  assert.equal(subscriptionProvidesProAccess("unpaid"), false);
  assert.equal(subscriptionProvidesProAccess("canceled"), false);
});

test("seat billing, invitations, webhooks, and admin use the shared production rules", async () => {
  const [seatRoute, teamRoute, webhook, billing, adminRoute, migration] = await Promise.all([
    readFile(new URL("../app/api/stripe/team-seats/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/providers/team/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/webhook/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/billing-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/accounts/[userId]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../database/migrations/073_team_invitation_seats.sql", import.meta.url), "utf8"),
  ]);
  assert.match(seatRoute, /status IN \('pending', 'active'\)/);
  assert.match(seatRoute, /prorationBehavior/);
  assert.match(seatRoute, /idempotencyKey/);
  assert.match(teamRoute, /Pending invitations|status IN \('pending', 'active'\)/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(webhook, /subscriptionProvidesProAccess/);
  assert.match(webhook, /SET status = 'inactive'/);
  assert.match(billing, /3 total seats included/);
  assert.match(billing, /Recurring total/);
  assert.match(billing, /aria-label="Remove one extra employee seat"/);
  assert.match(adminRoute, /reserved_worker_count/);
  assert.match(migration, /'pending', 'active', 'inactive'/);
});
