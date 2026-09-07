import { NextResponse } from "next/server";
import { checkAndRecordContent } from "@/lib/content-safety";
import { database } from "@/lib/database";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";
import { getProviderAccess } from "@/lib/provider-access";

type Provider = { id: string; user_id: string; timezone: string };

async function currentProvider() {
  const access = await getProviderAccess();
  if (!access) return null;
  const result = await database.query<Provider>(
    `SELECT p.id::text, p.user_id, COALESCE((SELECT timezone FROM availability WHERE provider_id = p.id LIMIT 1), 'America/Los_Angeles') AS timezone
     FROM provider_profiles p WHERE p.id::text = $1 AND p.is_active = true`, [access.providerId]);
  return result.rows[0] ? { ...access, provider: result.rows[0] } : null;
}

export async function GET(request: Request) {
  const current = await currentProvider();
  if (!current) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const requestedCompany = new URL(request.url).searchParams.get("company")?.trim() ?? "";
  const companyName = current.isOwner ? requestedCompany : current.memberCompanyName ?? "";
  const [availability, timeOff, requests] = await Promise.all([
    database.query<{ member_id: string; weekday: number; start_time: string; end_time: string }>(
      `SELECT a.team_member_id::text AS member_id, a.weekday, a.start_time::text, a.end_time::text
       FROM team_member_availability a JOIN provider_team_members m ON m.id = a.team_member_id
       WHERE m.provider_id::text = $1 AND ($2::uuid IS NULL OR m.id = $2::uuid)
         AND ($3::text = '' OR m.company_name = $3) ORDER BY a.team_member_id, a.weekday`, [current.provider.id, current.isOwner ? null : current.memberId, companyName]),
    database.query<{ id: string; member_id: string | null; starts_at: Date; ends_at: Date; reason: string }>(
      `SELECT id::text, team_member_id::text AS member_id, starts_at, ends_at, reason
       FROM provider_time_off blocked WHERE provider_id::text = $1 AND ($2::uuid IS NULL OR team_member_id = $2::uuid)
         AND ($3::text = '' OR blocked.team_member_id IS NULL OR EXISTS (
           SELECT 1 FROM provider_team_members member WHERE member.id = blocked.team_member_id AND member.company_name = $3
         )) AND ends_at >= now() - interval '30 days'
       ORDER BY starts_at`, [current.provider.id, current.isOwner ? null : current.memberId, companyName]),
    database.query<{ id: string; member_id: string; member_name: string; slots: Array<{ weekday: number; startTime: string; endTime: string }>; status: string; created_at: Date }>(
      `SELECT request.id::text, request.team_member_id::text AS member_id, member.name AS member_name,
              request.slots, request.status, request.created_at
       FROM team_schedule_requests request JOIN provider_team_members member ON member.id = request.team_member_id
       WHERE request.provider_id::text = $1 AND request.status = 'pending' AND ($2::uuid IS NULL OR request.team_member_id = $2::uuid)
         AND ($3::text = '' OR member.company_name = $3)
       ORDER BY request.created_at DESC`, [current.provider.id, current.isOwner ? null : current.memberId, companyName]),
  ]);
  return NextResponse.json({ timezone: current.provider.timezone, isOwner: current.isOwner, currentMemberId: current.memberId,
    availability: availability.rows.map((slot) => ({ memberId: slot.member_id, weekday: slot.weekday, startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5) })),
    timeOff: timeOff.rows.map((block) => ({ id: block.id, memberId: block.member_id, startsAt: block.starts_at, endsAt: block.ends_at, reason: block.reason })),
    scheduleRequests: requests.rows.map((item) => ({ id: item.id, memberId: item.member_id, memberName: item.member_name, slots: item.slots, status: item.status, createdAt: item.created_at })) });
}

export async function PUT(request: Request) {
  const current = await currentProvider();
  if (!current) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  if (!await enforceRateLimit({ request, userId: current.session.user.id, bucket: "team-schedule", limit: 20 }))
    return NextResponse.json({ error: "Too many schedule changes. Please wait a minute." }, { status: 429 });
  const body = await request.json() as { memberId?: unknown; slots?: unknown };
  const requestedMemberId = typeof body.memberId === "string" ? body.memberId : "";
  const memberId = current.isOwner ? requestedMemberId : current.memberId ?? "";
  const slots = Array.isArray(body.slots) ? body.slots.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const slot = item as { weekday?: unknown; startTime?: unknown; endTime?: unknown };
    if (!Number.isInteger(slot.weekday) || Number(slot.weekday) < 0 || Number(slot.weekday) > 6 ||
      typeof slot.startTime !== "string" || typeof slot.endTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) || slot.endTime <= slot.startTime) return [];
    return [{ weekday: Number(slot.weekday), startTime: slot.startTime, endTime: slot.endTime }];
  }) : [];
  if (!memberId || slots.length > 7 || slots.length !== (Array.isArray(body.slots) ? body.slots.length : 0))
    return NextResponse.json({ error: "Choose a worker and valid working hours." }, { status: 400 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const member = await client.query("SELECT 1 FROM provider_team_members WHERE id::text = $1 AND provider_id::text = $2 AND status = 'active'", [memberId, current.provider.id]);
    if (!member.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Worker not found." }, { status: 404 }); }
    if (!current.isOwner) {
      const requestResult = await client.query<{ id: string }>(
        `INSERT INTO team_schedule_requests (provider_id, team_member_id, slots)
         VALUES ($1::uuid, $2::uuid, $3::jsonb)
         ON CONFLICT (team_member_id) WHERE status = 'pending' DO UPDATE SET slots = EXCLUDED.slots, updated_at = now()
         RETURNING id::text`, [current.provider.id, memberId, JSON.stringify(slots)],
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
         VALUES ($1, 'team_schedule', 'Working hours need approval', $2, '/provider/dashboard/team',
           'team-schedule-request-' || $3 || '-' || extract(epoch from now())::bigint)`,
        [current.provider.user_id, `${current.session.user.name || "A worker"} submitted new working hours.`, requestResult.rows[0].id],
      );
      await client.query("COMMIT");
      await recordActivity({ userId: current.session.user.id, action: "worker_schedule_requested", targetType: "team_schedule_request", targetId: requestResult.rows[0].id });
      return NextResponse.json({ ok: true, pendingApproval: true, slots });
    }
    await client.query("DELETE FROM team_member_availability WHERE team_member_id::text = $1", [memberId]);
    for (const slot of slots) await client.query(
      `INSERT INTO team_member_availability (team_member_id, weekday, start_time, end_time, timezone)
       VALUES ($1::uuid, $2, $3::time, $4::time, $5)`, [memberId, slot.weekday, slot.startTime, slot.endTime, current.provider.timezone]);
    await client.query("COMMIT");
    await recordActivity({ userId: current.session.user.id, action: "worker_schedule_updated", targetType: "team_member", targetId: memberId });
    return NextResponse.json({ ok: true, slots });
  } catch (error) { await client.query("ROLLBACK"); console.error("Worker schedule update failed", error); return NextResponse.json({ error: "We could not save those hours." }, { status: 500 }); }
  finally { client.release(); }
}

export async function PATCH(request: Request) {
  const current = await currentProvider();
  if (!current) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  if (!current.isOwner) return NextResponse.json({ error: "Only the company owner can review working hours." }, { status: 403 });
  const body = await request.json() as { requestId?: unknown; decision?: unknown };
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : "";
  if (!requestId || !decision) return NextResponse.json({ error: "Choose a schedule request and decision." }, { status: 400 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{ team_member_id: string; slots: Array<{ weekday: number; startTime: string; endTime: string }> }>(
      `SELECT team_member_id::text, slots FROM team_schedule_requests
       WHERE id::text = $1 AND provider_id::text = $2 AND status = 'pending' FOR UPDATE`,
      [requestId, current.provider.id],
    );
    const saved = pending.rows[0];
    if (!saved) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Schedule request not found." }, { status: 404 }); }
    if (decision === "approve") {
      await client.query("DELETE FROM team_member_availability WHERE team_member_id::text = $1", [saved.team_member_id]);
      for (const slot of saved.slots) await client.query(
        `INSERT INTO team_member_availability (team_member_id, weekday, start_time, end_time, timezone)
         VALUES ($1::uuid, $2, $3::time, $4::time, $5)`,
        [saved.team_member_id, slot.weekday, slot.startTime, slot.endTime, current.provider.timezone],
      );
    }
    await client.query(
      `UPDATE team_schedule_requests SET status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now() WHERE id::text = $1`,
      [requestId, decision === "approve" ? "approved" : "rejected", current.session.user.id],
    );
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, href, dedupe_key)
       SELECT member.user_id, 'team_schedule', $2, $3, '/provider/dashboard/team',
         'team-schedule-review-' || $1 || '-' || $4
       FROM provider_team_members member
       WHERE member.id::text = $5 AND member.user_id IS NOT NULL`,
      [requestId, decision === "approve" ? "Working hours approved" : "Working hours need changes",
        decision === "approve" ? "Your company owner approved your working hours." : "Your company owner asked you to update your working hours.",
        decision, saved.team_member_id],
    );
    await client.query("COMMIT");
    await recordActivity({ userId: current.session.user.id, action: decision === "approve" ? "worker_schedule_approved" : "worker_schedule_rejected", targetType: "team_schedule_request", targetId: requestId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Schedule review failed", error);
    return NextResponse.json({ error: "We could not review those hours." }, { status: 500 });
  } finally { client.release(); }
}

export async function POST(request: Request) {
  const current = await currentProvider();
  if (!current) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  if (!await enforceRateLimit({ request, userId: current.session.user.id, bucket: "team-time-off", limit: 20 }))
    return NextResponse.json({ error: "Too many time-off changes. Please wait a minute." }, { status: 429 });
  const body = await request.json() as { memberId?: unknown; startsAt?: unknown; endsAt?: unknown; reason?: unknown };
  const requestedMemberId = body.memberId === null || body.memberId === "owner" ? null : typeof body.memberId === "string" ? body.memberId : "";
  const memberId = current.isOwner ? requestedMemberId : current.memberId ?? "";
  const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(Number.NaN);
  const endsAt = typeof body.endsAt === "string" ? new Date(body.endsAt) : new Date(Number.NaN);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (memberId === "" || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt || reason.length < 2 || reason.length > 200)
    return NextResponse.json({ error: "Choose a staff member, a valid time range, and a short reason." }, { status: 400 });
  const safety = await checkAndRecordContent({ userId: current.session.user.id, surface: "time_off", fields: [reason] });
  if (!safety.allowed) return NextResponse.json({ error: safety.message }, { status: 422 });
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [current.provider.id]);
    if (memberId) {
      const member = await client.query("SELECT 1 FROM provider_team_members WHERE id::text = $1 AND provider_id::text = $2 AND status = 'active'", [memberId, current.provider.id]);
      if (!member.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Worker not found." }, { status: 404 });
      }
    }
    const bookingConflict = await client.query(`SELECT 1 FROM bookings booking
      JOIN booking_assignees assigned ON assigned.booking_id = booking.id
      WHERE booking.provider_id::text = $1
      AND (($2::uuid IS NULL AND assigned.is_owner = true) OR assigned.team_member_id = $2::uuid)
      AND booking.status = 'confirmed' AND booking.starts_at < $4 AND booking.ends_at > $3 LIMIT 1`, [current.provider.id, memberId, startsAt, endsAt]);
    if (bookingConflict.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "That staff member already has a confirmed booking during this time. Reassign or cancel it first." }, { status: 409 });
    }
    const result = await client.query<{ id: string }>(`INSERT INTO provider_time_off (provider_id, team_member_id, starts_at, ends_at, reason)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5) RETURNING id::text`, [current.provider.id, memberId, startsAt, endsAt, reason]);
    await client.query("COMMIT");
    await recordActivity({ userId: current.session.user.id, action: "time_off_added", targetType: "time_off", targetId: result.rows[0].id });
    return NextResponse.json({ block: { id: result.rows[0].id, memberId, startsAt, endsAt, reason } }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Time-off creation failed", error);
    return NextResponse.json({ error: "We could not add that time-off block." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const current = await currentProvider();
  if (!current) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });
  const body = await request.json() as { id?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const result = await database.query(
    `DELETE FROM provider_time_off WHERE id::text = $1 AND provider_id::text = $2
       AND ($3::uuid IS NULL OR team_member_id = $3::uuid)`,
    [id, current.provider.id, current.isOwner ? null : current.memberId],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Time-off block not found." }, { status: 404 });
  await recordActivity({ userId: current.session.user.id, action: "time_off_removed", targetType: "time_off", targetId: id });
  return NextResponse.json({ ok: true });
}
