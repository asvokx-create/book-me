import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { hasAdminAccess, isOwnerEmail } from "@/lib/admin";
import { PLAN_ENTITLEMENTS, type ProviderPlan } from "@/lib/plans";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit } from "@/lib/request-security";

async function currentProvider() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const result = await database.query<{ id: string; plan: ProviderPlan; extra_team_seats: number }>(
    "SELECT id::text, plan, extra_team_seats FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const provider = result.rows[0];
  if (!provider) return null;

  if (isOwnerEmail(session.user.email)) {
    if (provider.plan !== "owner") {
      await database.query("UPDATE provider_profiles SET plan = 'owner', updated_at = now() WHERE id::text = $1", [provider.id]);
    }
    return { ...provider, plan: "owner" as const, session };
  }
  if (await hasAdminAccess(session.user.id, session.user.email)) {
    return { ...provider, plan: "business" as const, session };
  }

  return { ...provider, session };
}

export async function GET(request: Request) {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider or team access not found." }, { status: 404 });
  const providerResult = await database.query<{ plan: ProviderPlan; extra_team_seats: number; business_name: string }>(
    "SELECT plan, extra_team_seats, business_name FROM provider_profiles WHERE id::text = $1",
    [access.providerId],
  );
  const provider = { id: access.providerId, ...providerResult.rows[0] };
  const companyResult = await database.query<{ business_name: string }>(
    `SELECT DISTINCT business_name FROM services WHERE provider_id::text = $1 AND is_active = true ORDER BY business_name`,
    [provider.id],
  );
  const companies = companyResult.rows.map((row) => row.business_name);
  if (!companies.length) companies.push(provider.business_name);
  const requestedCompany = new URL(request.url).searchParams.get("company")?.trim() ?? "";
  const companyName = access.isOwner
    ? companies.includes(requestedCompany) ? requestedCompany : companies[0]
    : access.memberCompanyName ?? provider.business_name;
  const result = await database.query<{ id: string; name: string; email: string; role: string; company_name: string; status: "active" | "inactive"; created_at: Date }>(
    `SELECT id::text, name, email, role, company_name, status, created_at
     FROM provider_team_members WHERE provider_id = $1 AND company_name = $2 AND status = 'active'
     ORDER BY created_at`,
    [provider.id, companyName],
  );
  const totalActive = await database.query<{ count: number }>(
    "SELECT count(DISTINCT lower(email))::int AS count FROM provider_team_members WHERE provider_id = $1 AND status = 'active'",
    [provider.id],
  );
  const baseSeatLimit = PLAN_ENTITLEMENTS[provider.plan].teamSeatLimit;
  return NextResponse.json({
    members: result.rows.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, companyName: member.company_name, status: member.status, createdAt: member.created_at })),
    companies: access.isOwner ? companies : [companyName],
    activeWorkerCount: totalActive.rows[0].count,
    plan: provider.plan,
    seatLimit: baseSeatLimit === null ? null : baseSeatLimit + (provider.plan === "pro" ? provider.extra_team_seats : 0),
    extraTeamSeats: provider.plan === "pro" ? provider.extra_team_seats : 0,
    isOwner: access.isOwner,
    currentMemberId: access.memberId,
    companyName,
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: session.user.id, bucket: "provider-team", limit: 20 })) return NextResponse.json({ error: "Too many team changes. Please wait a minute." }, { status: 429 });
  const ownerProfile = await database.query("SELECT 1 FROM provider_profiles WHERE user_id = $1 AND is_active = true", [session.user.id]);
  if (!ownerProfile.rowCount) return NextResponse.json({ error: "Only the company owner can add workers." }, { status: 403 });
  const isOwner = isOwnerEmail(session.user.email);
  const isAdmin = await hasAdminAccess(session.user.id, session.user.email);
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body.role === "string" ? body.role.trim().replace(/\s+/g, " ") : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter the worker's name and a valid email." }, { status: 400 });
  if (email === session.user.email.toLowerCase()) return NextResponse.json({ error: "The company owner is already included. Add a worker using their own account email." }, { status: 400 });
  if (role.length < 2 || role.length > 40 || !/^[A-Za-z0-9 &'./-]+$/.test(role)) return NextResponse.json({ error: "Enter a professional role between 2 and 40 characters." }, { status: 400 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const providerResult = await client.query<{ id: string; plan: ProviderPlan; extra_team_seats: number }>(
      "SELECT id::text, plan, extra_team_seats FROM provider_profiles WHERE user_id = $1 AND is_active = true FOR UPDATE",
      [session.user.id],
    );
    const savedProvider = providerResult.rows[0];
    const provider = savedProvider && isOwner ? { ...savedProvider, plan: "owner" as const } : savedProvider && isAdmin ? { ...savedProvider, plan: "business" as const } : savedProvider;
    if (!provider) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Provider profile not found." }, { status: 404 }); }
    if (isOwner && savedProvider.plan !== "owner") {
      await client.query("UPDATE provider_profiles SET plan = 'owner', updated_at = now() WHERE id::text = $1", [provider.id]);
    }
    const validCompany = await client.query<{ id: string }>(
      "SELECT id::text FROM provider_companies WHERE provider_id::text = $1 AND name = $2 AND is_active = true LIMIT 1",
      [provider.id, companyName],
    );
    if (!companyName || !validCompany.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Choose one of your active listing companies." }, { status: 400 });
    }
    const baseSeats = PLAN_ENTITLEMENTS[provider.plan].teamSeatLimit;
    const seats = baseSeats === null ? null : baseSeats + (provider.plan === "pro" ? provider.extra_team_seats : 0);
    const countResult = await client.query<{ count: number; already_active: boolean }>(
      `SELECT count(DISTINCT lower(email))::int AS count,
              COALESCE(bool_or(lower(email) = lower($2) AND status = 'active'), false) AS already_active
       FROM provider_team_members WHERE provider_id = $1`,
      [provider.id, email],
    );
    const workerLimit = seats === null ? null : Math.max(seats - 1, 0);
    if (workerLimit !== null && !countResult.rows[0].already_active && countResult.rows[0].count >= workerLimit) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: provider.plan === "starter" ? "Starter includes the owner only. Upgrade to Pro to add workers." : `Your ${PLAN_ENTITLEMENTS[provider.plan].name} plan currently allows ${workerLimit} workers. Add another employee seat from Billing for $0.50/month.`, upgradeRequired: true }, { status: 403 });
    }
    const result = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO provider_team_members (provider_id, company_id, company_name, name, email, role, user_id)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, (SELECT id FROM "user" WHERE lower(email) = lower($5) LIMIT 1))
       ON CONFLICT (provider_id, company_name, email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, status = 'active',
         company_id = EXCLUDED.company_id, user_id = COALESCE(provider_team_members.user_id, EXCLUDED.user_id)
       RETURNING id::text, created_at`,
      [provider.id, validCompany.rows[0].id, companyName, name, email, role],
    );
    await client.query(
      `INSERT INTO provider_team_member_locations (team_member_id, location_id)
       SELECT $1::uuid, location.id FROM provider_locations location
       WHERE location.company_id::text = $2 AND location.is_active = true
       ON CONFLICT DO NOTHING`,
      [result.rows[0].id, validCompany.rows[0].id],
    );
    const activeCount = await client.query<{ count: number }>(
      "SELECT count(DISTINCT lower(email))::int AS count FROM provider_team_members WHERE provider_id = $1 AND status = 'active'",
      [provider.id],
    );
    await client.query("COMMIT");
    return NextResponse.json({ activeWorkerCount: activeCount.rows[0].count, member: { id: result.rows[0].id, name, email, role, companyName, status: "active", createdAt: result.rows[0].created_at } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Team member add failed", error);
    return NextResponse.json({ error: "We could not add that worker." }, { status: 500 });
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  const provider = await currentProvider();
  if (!provider) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  if (!await enforceRateLimit({ request, userId: provider.session.user.id, bucket: "provider-team", limit: 20 })) return NextResponse.json({ error: "Too many team changes. Please wait a minute." }, { status: 429 });
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
  if (!await enforceRateLimit({ request, userId: provider.session.user.id, bucket: "provider-team", limit: 20 })) return NextResponse.json({ error: "Too many team changes. Please wait a minute." }, { status: 429 });
  const body = (await request.json()) as { memberId?: unknown };
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) return NextResponse.json({ error: "Choose a team member." }, { status: 400 });
  const upcoming = await database.query(`SELECT 1 FROM bookings booking
    JOIN booking_assignees assigned ON assigned.booking_id = booking.id
    WHERE assigned.team_member_id::text = $1 AND booking.status = 'confirmed' AND booking.ends_at > now() LIMIT 1`, [memberId]);
  if (upcoming.rowCount) return NextResponse.json({ error: "Reassign this worker's upcoming bookings before removing them." }, { status: 409 });
  const result = await database.query("DELETE FROM provider_team_members WHERE id::text = $1 AND provider_id = $2", [memberId, provider.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  const activeCount = await database.query<{ count: number }>(
    "SELECT count(DISTINCT lower(email))::int AS count FROM provider_team_members WHERE provider_id = $1 AND status = 'active'",
    [provider.id],
  );
  return NextResponse.json({ ok: true, activeWorkerCount: activeCount.rows[0].count });
}
