export type ExpenseBillingCycle = "monthly" | "yearly" | "one_time";

export type AdminExpense = {
  id: string;
  service_name: string;
  notes: string;
  cost_cents: number;
  billing_cycle: ExpenseBillingCycle;
  next_renewal_date: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export function monthlyEquivalentCents(expense: Pick<AdminExpense, "cost_cents" | "billing_cycle">) {
  if (expense.billing_cycle === "monthly") return expense.cost_cents;
  if (expense.billing_cycle === "yearly") return Math.round(expense.cost_cents / 12);
  return 0;
}

export function annualEquivalentCents(expense: Pick<AdminExpense, "cost_cents" | "billing_cycle">) {
  if (expense.billing_cycle === "monthly") return expense.cost_cents * 12;
  if (expense.billing_cycle === "yearly") return expense.cost_cents;
  return 0;
}

export function summarizeExpenses(expenses: AdminExpense[], now = new Date()) {
  const active = expenses.filter((expense) => expense.status === "active");
  const today = localDateKey(now);
  const inThirtyDays = new Date(now);
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const renewalCutoff = localDateKey(inThirtyDays);

  return {
    monthlyRecurringCents: active.reduce((sum, expense) => sum + monthlyEquivalentCents(expense), 0),
    annualRecurringCents: active.reduce((sum, expense) => sum + annualEquivalentCents(expense), 0),
    oneTimeCents: active.reduce((sum, expense) => sum + (expense.billing_cycle === "one_time" ? expense.cost_cents : 0), 0),
    incurredExpenseCents: active.reduce((sum, expense) => sum + (
      expense.billing_cycle === "one_time" || (expense.next_renewal_date !== null && expense.next_renewal_date <= today)
        ? expense.cost_cents
        : 0
    ), 0),
    renewalsDue: active.filter((expense) => expense.next_renewal_date && expense.next_renewal_date >= today && expense.next_renewal_date <= renewalCutoff).length,
  };
}

export function totalTrackedExpenseCents(summary: Pick<ReturnType<typeof summarizeExpenses>, "incurredExpenseCents">) {
  return summary.incurredExpenseCents;
}

export function totalProfitCents(platformRevenueCents: number, expenses: Pick<ReturnType<typeof summarizeExpenses>, "incurredExpenseCents">) {
  return platformRevenueCents - totalTrackedExpenseCents(expenses);
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
