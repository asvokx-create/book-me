import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

type AvailabilityInput = { weekday?: unknown; startTime?: unknown; endTime?: unknown };

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Log in to update your availability." }, { status: 401 });

  const body = (await request.json()) as { slots?: AvailabilityInput[] };
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const weekdays = new Set<number>();

  for (const slot of slots) {
    if (!Number.isInteger(slot.weekday) || Number(slot.weekday) < 0 || Number(slot.weekday) > 6 || !isTime(slot.startTime) || !isTime(slot.endTime) || slot.startTime >= slot.endTime || weekdays.has(Number(slot.weekday))) {
      return NextResponse.json({ error: "Choose valid, non-overlapping hours for each selected day." }, { status: 400 });
    }
    weekdays.add(Number(slot.weekday));
  }
  if (slots.length === 0) return NextResponse.json({ error: "Select at least one working day." }, { status: 400 });

  const providerResult = await database.query<{ id: string }>(
    "SELECT id::text FROM provider_profiles WHERE user_id = $1 AND is_active = true",
    [session.user.id],
  );
  const providerId = providerResult.rows[0]?.id;
  if (!providerId) return NextResponse.json({ error: "Provider profile not found." }, { status: 404 });

  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM availability WHERE provider_id::text = $1", [providerId]);
    for (const slot of slots) {
      await client.query(
        `INSERT INTO availability (provider_id, weekday, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [providerId, slot.weekday, slot.startTime, slot.endTime],
      );
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, slots });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Availability update failed", error);
    return NextResponse.json({ error: "We could not save your hours. Please try again." }, { status: 500 });
  } finally {
    client.release();
  }
}
