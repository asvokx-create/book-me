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
     ), generated_slots AS (
       SELECT si.provider_id, si.duration_minutes, a.timezone,
              generated.starts_at
       FROM service_info si
       JOIN availability a ON a.provider_id = si.provider_id
       CROSS JOIN LATERAL generate_series(
         ($2::date + a.start_time) AT TIME ZONE a.timezone,
         (($2::date + a.end_time) AT TIME ZONE a.timezone) - make_interval(mins => si.duration_minutes),
         interval '30 minutes'
       ) AS generated(starts_at)
       WHERE a.weekday = EXTRACT(DOW FROM $2::date)
     )
     SELECT to_char(gs.starts_at AT TIME ZONE gs.timezone, 'HH24:MI') AS time
     FROM generated_slots gs
     WHERE gs.starts_at > CURRENT_TIMESTAMP
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.provider_id = gs.provider_id
           AND b.status = 'confirmed'
           AND b.starts_at < gs.starts_at + make_interval(mins => gs.duration_minutes)
           AND b.ends_at > gs.starts_at
       )
     ORDER BY gs.starts_at`,
    [serviceId, date],
  );

  return NextResponse.json({ times: result.rows.map((row) => row.time.slice(0, 5)) });
}
