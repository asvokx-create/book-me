import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { annualEquivalentCents, monthlyEquivalentCents, summarizeExpenses, totalProfitCents, totalTrackedExpenseCents, type AdminExpense } from "../lib/admin-expenses.ts";

const projectRoot = process.cwd();
const read = (...parts: string[]) => readFileSync(join(projectRoot, ...parts), "utf8");

test("expense totals forecast recurring charges but record them only on their renewal date", () => {
  const expenses: AdminExpense[] = [
    expense("monthly", 2500, "2026-09-10"),
    expense("yearly", 12000, "2026-10-20"),
    expense("one_time", 5000, null),
    { ...expense("monthly", 9999, "2026-10-01"), status: "archived" },
  ];
  assert.equal(monthlyEquivalentCents(expenses[0]), 2500);
  assert.equal(monthlyEquivalentCents(expenses[1]), 1000);
  assert.equal(annualEquivalentCents(expenses[0]), 30000);
  assert.equal(annualEquivalentCents(expenses[1]), 12000);
  const summary = summarizeExpenses(expenses, new Date(2026, 8, 29));
  assert.deepEqual(summary, {
    monthlyRecurringCents: 3500,
    annualRecurringCents: 42000,
    oneTimeCents: 5000,
    incurredExpenseCents: 7500,
    renewalsDue: 1,
  });
  assert.equal(totalTrackedExpenseCents(summary), 7500);
  assert.equal(totalProfitCents(125000, summary), 117500);
});

test("admin expenses are protected, audited, manual, and recoverably archived", () => {
  const api = read("app", "api", "admin", "expenses", "route.ts");
  const migration = read("database", "migrations", "065_admin_expenses.sql");
  const page = read("app", "admin", "expenses", "page.tsx");
  const component = read("components", "admin-expenses.tsx");

  assert.match(api, /getAdminSession/);
  assert.match(api, /enforceRateLimit/);
  assert.match(api, /admin_audit_log/);
  assert.doesNotMatch(api, /stripe|bank/i);
  assert.match(migration, /billing_cycle IN \('monthly', 'yearly', 'one_time'\)/);
  assert.match(migration, /status IN \('active', 'archived'\)/);
  assert.doesNotMatch(api, /export async function DELETE/);
  assert.match(page, /redirect\("\/login\?redirect=\/admin\/expenses"\)/);
  assert.match(component, /No bank or Stripe account is connected/);
  assert.match(component, /label="Total expenses"/);
  assert.match(component, /label="Total profit"/);
  assert.match(component, /Charges incurred through today/);
  assert.match(component, /Platform revenue after refunds, less incurred expenses/);
  assert.match(page, /initialPlatformRevenueCents/);
  assert.match(component, /role="region"/);
  assert.match(component, /tabIndex=\{0\}/);
});

function expense(billing_cycle: AdminExpense["billing_cycle"], cost_cents: number, next_renewal_date: string | null): AdminExpense {
  return { id: `${billing_cycle}-${cost_cents}`, service_name: "Test", notes: "", cost_cents, billing_cycle, next_renewal_date, status: "active", created_at: "", updated_at: "" };
}
