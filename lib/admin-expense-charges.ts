import "server-only";

import { database } from "@/lib/database";
import type { ExpenseBillingCycle } from "@/lib/admin-expenses";

type DueExpense = {
  id: string;
  cost_cents: number;
  billing_cycle: Exclude<ExpenseBillingCycle, "one_time">;
  next_renewal_date: string;
};

export async function reconcileAdminExpenseRenewals(today = pacificDateKey()) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const due = await client.query<DueExpense>(`SELECT id::text, cost_cents, billing_cycle, next_renewal_date::text
      FROM admin_expenses
      WHERE status = 'active' AND billing_cycle IN ('monthly', 'yearly') AND next_renewal_date <= $1::date
      FOR UPDATE`, [today]);

    for (const expense of due.rows) {
      let renewalDate = expense.next_renewal_date;
      while (renewalDate <= today) {
        await client.query(`INSERT INTO admin_expense_charges (expense_id, charge_kind, charged_on, amount_cents)
          VALUES ($1::uuid, 'renewal', $2::date, $3) ON CONFLICT (expense_id, charge_kind, charged_on) DO NOTHING`,
        [expense.id, renewalDate, expense.cost_cents]);
        renewalDate = nextRenewalDate(renewalDate, expense.billing_cycle);
      }
      await client.query("UPDATE admin_expenses SET next_renewal_date = $2::date WHERE id::text = $1", [expense.id, renewalDate]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getAdminExpenseChargeTotal() {
  const result = await database.query<{ total_cents: string | number }>("SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total_cents FROM admin_expense_charges");
  return Number(result.rows[0]?.total_cents ?? 0);
}

export function nextRenewalDate(value: string, billingCycle: Exclude<ExpenseBillingCycle, "one_time">) {
  const [year, month, day] = value.split("-").map(Number);
  const monthOffset = billingCycle === "monthly" ? 1 : 12;
  const targetMonth = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonth / 12);
  const targetMonthIndex = targetMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function pacificDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function nextUpcomingRenewalDate(value: string, billingCycle: Exclude<ExpenseBillingCycle, "one_time">, today = pacificDateKey()) {
  let renewalDate = value;
  while (renewalDate <= today) renewalDate = nextRenewalDate(renewalDate, billingCycle);
  return renewalDate;
}
