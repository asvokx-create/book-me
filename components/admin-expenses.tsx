"use client";

import { FormEvent, useMemo, useState } from "react";
import { AdminExpense, annualEquivalentCents, ExpenseBillingCycle, monthlyEquivalentCents, summarizeExpenses, totalProfitCents, totalTrackedExpenseCents } from "@/lib/admin-expenses";
import CustomSelect from "@/components/custom-select";
import DatePicker from "@/components/date-picker";

type FormState = { serviceName: string; cost: string; billingCycle: ExpenseBillingCycle; renewalDate: string; notes: string };
const emptyForm: FormState = { serviceName: "", cost: "", billingCycle: "monthly", renewalDate: "", notes: "" };

export default function AdminExpenses({ initialExpenses, initialPlatformRevenueCents }: { initialExpenses: AdminExpense[]; initialPlatformRevenueCents: number }) {
  const [expenses, setExpenses] = useState<AdminExpense[]>(initialExpenses);
  const [platformRevenueCents, setPlatformRevenueCents] = useState(initialPlatformRevenueCents);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/expenses", { cache: "no-store" });
      const data = await response.json() as { expenses?: AdminExpense[]; platformRevenueCents?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Expenses could not be loaded.");
      setExpenses(data.expenses ?? []);
      if (typeof data.platformRevenueCents === "number") setPlatformRevenueCents(data.platformRevenueCents);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Expenses could not be loaded."); }
    finally { setLoading(false); }
  }

  const totals = useMemo(() => summarizeExpenses(expenses), [expenses]);
  const totalExpensesCents = totalTrackedExpenseCents(totals);
  const totalProfit = totalProfitCents(platformRevenueCents, totals);
  const visibleExpenses = expenses.filter((expense) => expense.status === (showArchived ? "archived" : "active"));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/expenses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { action: "update", id: editingId } : {}), ...form }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "The expense could not be saved.");
      setForm(emptyForm); setEditingId(null); setMessage(editingId ? "Expense updated." : "Expense added.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The expense could not be saved."); }
    finally { setSaving(false); }
  }

  function edit(expense: AdminExpense) {
    setEditingId(expense.id);
    setForm({ serviceName: expense.service_name, cost: (expense.cost_cents / 100).toFixed(2), billingCycle: expense.billing_cycle, renewalDate: expense.next_renewal_date ?? "", notes: expense.notes });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function changeStatus(expense: AdminExpense) {
    setMessage("");
    const action = expense.status === "active" ? "archive" : "restore";
    const response = await fetch("/api/admin/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: expense.id }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setMessage(data.error || "The expense could not be changed."); return; }
    setMessage(action === "archive" ? "Expense archived." : "Expense restored.");
    await load();
  }

  return <div className="dashboard-container px-5 py-8">
    <section aria-labelledby="expense-summary-title">
      <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Private admin tracker</p><h1 id="expense-summary-title" className="mt-2 text-3xl font-bold sm:text-4xl">Expenses</h1><p className="mt-2 max-w-2xl text-[#617169]">Track subscriptions and one-time business costs manually. No bank or Stripe account is connected.</p></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Monthly forecast" value={money(totals.monthlyRecurringCents)} detail="Active recurring services" />
        <SummaryCard label="Annual forecast" value={money(totals.annualRecurringCents)} detail="Active recurring services" />
        <SummaryCard label="One-time tracked" value={money(totals.oneTimeCents)} detail="Included when recorded" />
        <SummaryCard label="Total expenses" value={money(totalExpensesCents)} detail="Charges incurred through today" />
        <SummaryCard label="Total profit" value={money(totalProfit)} detail="Platform revenue after refunds, less incurred expenses" />
        <SummaryCard label="Renewals in 30 days" value={String(totals.renewalsDue)} detail="Active recurring services" />
      </div>
    </section>

    <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7" aria-labelledby="expense-form-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="expense-form-title" className="text-2xl font-bold">{editingId ? "Edit expense" : "Add an expense"}</h2><p className="mt-1 text-sm text-[#718078]">Enter the amount charged for its selected billing cycle.</p></div>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="rounded-full border border-[#183126]/15 px-4 py-2 text-sm font-bold">Cancel edit</button>}</div>
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Service"><input required maxLength={160} value={form.serviceName} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder="Example: Website hosting" className="expense-input" /></Field>
        <Field label="Cost ($)"><input required min="0.01" step="0.01" type="number" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" className="expense-input" /></Field>
        <Field label="Billing cycle"><CustomSelect ariaLabel="Billing cycle" value={form.billingCycle} onChange={(billingCycle) => setForm({ ...form, billingCycle: billingCycle as ExpenseBillingCycle, renewalDate: billingCycle === "one_time" ? "" : form.renewalDate })} buttonClassName="expense-input"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="one_time">One-time</option></CustomSelect></Field>
        <Field label={form.billingCycle === "one_time" ? "Renewal date (not needed)" : "Next renewal date"}><DatePicker ariaLabel="Next renewal date" required={form.billingCycle !== "one_time"} disabled={form.billingCycle === "one_time"} value={form.renewalDate} onChange={(renewalDate) => setForm({ ...form, renewalDate })} buttonClassName="expense-input disabled:cursor-not-allowed disabled:opacity-45" /></Field>
        <label className="font-bold md:col-span-2 lg:col-span-4">Notes <span className="font-normal text-[#718078]">(optional)</span><textarea maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Account, plan, or reminder details" className="expense-input mt-2 min-h-24 resize-y" /></label>
        <div className="md:col-span-2 lg:col-span-4"><button disabled={saving} className="min-h-12 rounded-full bg-[#f7e84b] px-6 py-3 font-bold text-[#183126] shadow-[0_12px_30px_rgba(247,232,75,.2)] disabled:opacity-55">{saving ? "Saving…" : editingId ? "Save changes" : "Add expense"}</button></div>
      </form>
      {message && <p role="status" className="mt-4 text-sm font-semibold text-[#4f6258]">{message}</p>}
    </section>

    <section className="mt-7 rounded-[2rem] border border-[#183126]/10 bg-white p-5 sm:p-7" aria-labelledby="expense-list-title">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 id="expense-list-title" className="text-2xl font-bold">Expense list</h2><p className="mt-1 text-sm text-[#718078]">Archive old services without permanently deleting their history.</p></div><div className="flex rounded-full bg-[#f4f4ef] p-1" role="group" aria-label="Expense status"><FilterButton active={!showArchived} onClick={() => setShowArchived(false)}>Active</FilterButton><FilterButton active={showArchived} onClick={() => setShowArchived(true)}>Archived</FilterButton></div></div>
      <div className="admin-table-scroll mt-5 max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-[#183126]/10" role="region" aria-label={`${showArchived ? "Archived" : "Active"} expenses table`} tabIndex={0}>
        <table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f5f5ef]"><tr className="text-xs uppercase tracking-wider text-[#718078]"><th className="px-4 py-3">Service</th><th className="px-4 py-3">Charge</th><th className="px-4 py-3">Billing</th><th className="px-4 py-3">Renewal</th><th className="px-4 py-3">Monthly equivalent</th><th className="px-4 py-3">Annual equivalent</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-[#183126]/10">{visibleExpenses.map((expense) => <tr key={expense.id}><td className="px-4 py-4"><p className="font-bold">{expense.service_name}</p>{expense.notes && <p className="mt-1 max-w-xs whitespace-pre-wrap text-xs text-[#718078]">{expense.notes}</p>}</td><td className="px-4 py-4 font-bold">{money(expense.cost_cents)}</td><td className="px-4 py-4">{cycleLabel(expense.billing_cycle)}</td><td className="px-4 py-4">{expense.next_renewal_date ? formatDate(expense.next_renewal_date) : "—"}</td><td className="px-4 py-4">{expense.billing_cycle === "one_time" ? "—" : money(monthlyEquivalentCents(expense))}</td><td className="px-4 py-4">{expense.billing_cycle === "one_time" ? "—" : money(annualEquivalentCents(expense))}</td><td className="px-4 py-4"><div className="admin-action-row justify-end">{expense.status === "active" && <button type="button" onClick={() => edit(expense)} className="rounded-full border border-[#183126]/15 px-4 py-2 font-bold">Edit</button>}<button type="button" onClick={() => void changeStatus(expense)} className="rounded-full border border-[#183126]/15 px-4 py-2 font-bold">{expense.status === "active" ? "Archive" : "Restore"}</button></div></td></tr>)}
          {!loading && visibleExpenses.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#718078]">{showArchived ? "No archived expenses." : "No expenses yet. Add your first service above."}</td></tr>}{loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#718078]">Loading expenses…</td></tr>}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="font-bold">{label}<span className="mt-2 block">{children}</span></label>; }
function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-[#183126]/10 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#718078]">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#718078]">{detail}</p></div>; }
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full px-4 py-2 text-sm font-bold ${active ? "bg-[#183126] text-white" : "text-[#617169]"}`}>{children}</button>; }
function money(cents: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100); }
function cycleLabel(cycle: ExpenseBillingCycle) { return cycle === "one_time" ? "One-time" : cycle[0].toUpperCase() + cycle.slice(1); }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
