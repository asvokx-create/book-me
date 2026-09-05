import { NextResponse } from "next/server";
import { database } from "@/lib/database";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request, context: RouteContext<"/api/services/[serviceId]/availability">) {
  const { serviceId } = await context.params;
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!datePattern.test(date)) return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });

  const result = await database.query<{ time: string }>(
    `WITH service_info AS (
       SELECT s.id, s.provider_id, s.duration_minutes
       FROM services s
       JOIN provider_profiles p ON p.id = s.provider_id
       WHERE s.id::text = $1 AND s.is_active = true AND p.is_active = true
     ), staff_hours AS (
       SELECT si.provider_id, NULL::uuid AS member_id, si.duration_minutes,
              a.weekday, a.start_time, a.end_time, a.timezone
       FROM service_info si JOIN availability a ON a.provider_id = si.provider_id
       UNION ALL
       SELECT si.provider_id, member.id AS member_id, si.duration_minutes,
              hours.weekday, hours.start_time, hours.end_time, hours.timezone
       FROM service_info si JOIN provider_team_members member ON member.provider_id = si.provider_id AND member.status = 'active'
       JOIN team_member_availability hours ON hours.team_member_id = member.id
     ), generated_slots AS (
       SELECT sh.provider_id, sh.member_id, sh.duration_minutes, sh.timezone,
              generated.starts_at
       FROM staff_hours sh
       CROSS JOIN LATERAL generate_series(
         ($2::date + sh.start_time) AT TIME ZONE sh.timezone,
         (($2::date + sh.end_time) AT TIME ZONE sh.timezone) - make_interval(mins => sh.duration_minutes),
         interval '30 minutes'
       ) AS generated(starts_at)
       WHERE sh.weekday = EXTRACT(DOW FROM $2::date)
     )
     SELECT DISTINCT to_char(gs.starts_at AT TIME ZONE gs.timezone, 'HH24:MI') AS time
     FROM generated_slots gs
     WHERE gs.starts_at > CURRENT_TIMESTAMP
       AND NOT EXISTS (
         SELECT 1 FROM provider_time_off blocked
         WHERE blocked.provider_id = gs.provider_id
           AND blocked.team_member_id IS NOT DISTINCT FROM gs.member_id
           AND blocked.starts_at < gs.starts_at + make_interval(mins => gs.duration_minutes)
           AND blocked.ends_at > gs.starts_at
       )
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.provider_id = gs.provider_id
           AND b.status = 'confirmed'
           AND b.assigned_team_member_id IS NOT DISTINCT FROM gs.member_id
           AND b.starts_at < gs.starts_at + make_interval(mins => gs.duration_minutes)
           AND b.ends_at > gs.starts_at
       )
     ORDER BY gs.starts_at`,
    [serviceId, date],
  );

  return NextResponse.json({ times: result.rows.map((row) => row.time.slice(0, 5)) });
}
