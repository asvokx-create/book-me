import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { database } from "@/lib/database";
import { enforceRateLimit } from "@/lib/request-security";
import { getAdminFinancialSummary } from "@/lib/admin-financial-summary";

const billingCycles = new Set(["monthly", "yearly", "one_time"]);

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const [result, financialSummary] = await Promise.all([database.query(`SELECT id::text, service_name, notes, cost_cents, billing_cycle,
    next_renewal_date::text, status, created_at, updated_at
    FROM admin_expenses
    ORDER BY status ASC, next_renewal_date ASC NULLS LAST, service_name ASC`), getAdminFinancialSummary()]);
  return NextResponse.json({ expenses: result.rows, platformRevenueCents: financialSummary.platformRevenueCents }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-expenses", limit: 40 })) {
    return NextResponse.json({ error: "Too many expense changes. Please wait a minute." }, { status: 429 });
  }
  const body = await request.json() as Record<string, unknown>;
  const expense = parseExpense(body);
  if (!expense) return NextResponse.json({ error: "Enter a service, valid cost, billing cycle, and renewal date for recurring expenses." }, { status: 400 });
  const result = await database.query<{ id: string }>(`INSERT INTO admin_expenses
    (service_name, notes, cost_cents, billing_cycle, next_renewal_date, created_by)
    VALUES ($1, $2, $3, $4, $5::date, $6) RETURNING id::text`,
  [expense.serviceName, expense.notes, expense.costCents, expense.billingCycle, expense.renewalDate, session.user.id]);
  await audit(session.user.id, "expense_created", result.rows[0].id, expense);
  return NextResponse.json({ ok: true, id: result.rows[0].id });
}

export async function PATCH(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "admin-expenses", limit: 40 })) {
    return NextResponse.json({ error: "Too many expense changes. Please wait a minute." }, { status: 429 });
  }
  const body = await request.json() as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!id) return NextResponse.json({ error: "Choose an expense to update." }, { status: 400 });

  if (action === "archive" || action === "restore") {
    const status = action === "archive" ? "archived" : "active";
    const result = await database.query(`UPDATE admin_expenses SET status=$2,
      archived_at=CASE WHEN $2='archived' THEN now() ELSE NULL END WHERE id::text=$1`, [id, status]);
    if (!result.rowCount) return NextResponse.json({ error: "That expense was not found." }, { status: 404 });
    await audit(session.user.id, `expense_${action}d`, id, { status });
    return NextResponse.json({ ok: true });
  }

  if (action !== "update") return NextResponse.json({ error: "Unsupported expense action." }, { status: 400 });
  const expense = parseExpense(body);
  if (!expense) return NextResponse.json({ error: "Enter a service, valid cost, billing cycle, and renewal date for recurring expenses." }, { status: 400 });
  const result = await database.query(`UPDATE admin_expenses SET service_name=$2, notes=$3, cost_cents=$4,
    billing_cycle=$5, next_renewal_date=$6::date WHERE id::text=$1`,
  [id, expense.serviceName, expense.notes, expense.costCents, expense.billingCycle, expense.renewalDate]);
  if (!result.rowCount) return NextResponse.json({ error: "That expense was not found." }, { status: 404 });
  await audit(session.user.id, "expense_updated", id, expense);
  return NextResponse.json({ ok: true });
}

function parseExpense(body: Record<string, unknown>) {
  const serviceName = typeof body.serviceName === "string" ? body.serviceName.trim().slice(0, 160) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  const billingCycle = typeof body.billingCycle === "string" ? body.billingCycle : "";
  const renewalDate = typeof body.renewalDate === "string" && body.renewalDate ? body.renewalDate : null;
  const costCents = Math.round(Number(body.cost) * 100);
  const validDate = renewalDate === null || isDateOnly(renewalDate);
  if (!serviceName || !billingCycles.has(billingCycle) || !Number.isInteger(costCents) || costCents <= 0 || !validDate || (billingCycle !== "one_time" && !renewalDate)) return null;
  return { serviceName, notes, costCents, billingCycle, renewalDate: billingCycle === "one_time" ? null : renewalDate };
}

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

async function audit(actorUserId: string, action: string, targetId: string, details: unknown) {
  await database.query(`INSERT INTO admin_audit_log (actor_user_id, action, target_type, target_id, details)
    VALUES ($1, $2, 'admin_expense', $3, $4::jsonb)`, [actorUserId, action, targetId, JSON.stringify(details)]);
}
