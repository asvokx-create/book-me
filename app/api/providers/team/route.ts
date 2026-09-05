import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { hasAdminAccess } from "@/lib/admin";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";

async function currentProvider() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const result = await database.query<{ id: string; plan: ProviderPlan }>(
    "SELECT id::text, plan FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const provider = result.rows[0];
  if (!provider) return null;

  if (await hasAdminAccess(session.user.id, session.user.email)) {
    if (provider.plan !== "business") {
      await database.query("UPDATE provider_profiles SET plan = 'business', updated_at = now() WHERE id::text = $1", [provider.id]);
    }
    return { ...provider, plan: "business" as const };
  }

  return provider;
}

export async function GET() {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const result = await database.query<{ id: string; name: string; email: string; role: string; status: "active" | "inactive"; created_at: Date }>(
    `SELECT id::text, name, email, role, status, created_at
     FROM provider_team_members WHERE provider_id = $1
     ORDER BY status, created_at`,
    [provider.id],
  );
  return NextResponse.json({
    members: result.rows.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, status: member.status, createdAt: member.created_at })),
    plan: provider.plan,
    seatLimit: PLAN_ENTITLEMENTS[provider.plan].teamSeatLimit,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const isAdmin = await hasAdminAccess(session.user.id, session.user.email);
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter the worker's name and a valid email." }, { status: 400 });
  if (role.length < 2 || role.length > 40 || !/^[A-Za-z0-9 &'./-]+$/.test(role)) return NextResponse.json({ error: "Enter a professional role between 2 and 40 characters." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const providerResult = await client.query<{ id: string; plan: ProviderPlan }>(
      "SELECT id::text, plan FROM provider_profiles WHERE user_id = $1 AND is_active = true FOR UPDATE",
      [session.user.id],
    );
    const savedProvider = providerResult.rows[0];
    const provider = savedProvider && isAdmin ? { ...savedProvider, plan: "business" as const } : savedProvider;
    if (!provider) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Provider profile not found." }, { status: 404 }); }
    if (isAdmin && savedProvider.plan !== "business") {
      await client.query("UPDATE provider_profiles SET plan = 'business', updated_at = now() WHERE id::text = $1", [provider.id]);
    }
    const seats = PLAN_ENTITLEMENTS[provider.plan].teamSeatLimit;
    const countResult = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM provider_team_members WHERE provider_id = $1 AND status = 'active'", [provider.id]);
    const workerLimit = seats === null ? null : Math.max(seats - 1, 0);
    if (workerLimit !== null && countResult.rows[0].count >= workerLimit) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: provider.plan === "starter" ? "Starter includes the owner only. Upgrade to Pro to add workers." : `Your ${PLAN_ENTITLEMENTS[provider.plan].name} plan allows ${workerLimit} workers.`, upgradeRequired: true }, { status: 403 });
    }
    const result = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO provider_team_members (provider_id, name, email, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider_id, email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, status = 'active'
       RETURNING id::text, created_at`,
      [provider.id, name, email, role],
    );
    await client.query("COMMIT");
    return NextResponse.json({ member: { id: result.rows[0].id, name, email, role, status: "active", createdAt: result.rows[0].created_at } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Team member add failed", error);
    return NextResponse.json({ error: "We could not add that worker." }, { status: 500 });
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const role = typeof body.role === "string" ? body.role.trim().replace(/\s+/g, " ") : "";
  if (!memberId || role.length < 2 || role.length > 40 || !/^[A-Za-z0-9 &'./-]+$/.test(role)) return NextResponse.json({ error: "Enter a professional role between 2 and 40 characters." }, { status: 400 });
  const result = await database.query("UPDATE provider_team_members SET role = $1 WHERE id::text = $2 AND provider_id = $3", [role, memberId, provider.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const body = (await request.json()) as { memberId?: unknown };
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) return NextResponse.json({ error: "Choose a team member." }, { status: 400 });
  const upcoming = await database.query(`SELECT 1 FROM bookings WHERE assigned_team_member_id::text = $1
    AND status = 'confirmed' AND ends_at > now() LIMIT 1`, [memberId]);
  if (upcoming.rowCount) return NextResponse.json({ error: "Reassign this worker's upcoming bookings before removing them." }, { status: 409 });
  const result = await database.query("DELETE FROM provider_team_members WHERE id::text = $1 AND provider_id = $2", [memberId, provider.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
