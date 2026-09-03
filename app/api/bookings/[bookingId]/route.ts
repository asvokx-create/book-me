import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

export async function PATCH(request: Request, context: RouteContext<"/api/bookings/[bookingId]">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { bookingId } = await context.params;
  const body = (await request.json()) as { action?: unknown };
  if (body.action !== "cancel") return NextResponse.json({ error: "Choose a valid booking action." }, { status: 400 });

  const result = await database.query(
    `UPDATE bookings SET status = 'cancelled'
     WHERE id::text = $1 AND customer_id = $2 AND status IN ('requested', 'confirmed')`,
    [bookingId, session.user.id],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Booking could not be cancelled." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
