import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Log in to save services." }, { status: 401 });

  const { serviceId } = await params;
  const result = await database.query(
    `INSERT INTO favorites (customer_id, service_id)
     SELECT $1, s.id FROM services s
     JOIN provider_profiles p ON p.id = s.provider_id
     WHERE s.id::text = $2 AND s.is_active = true AND p.is_active = true
     ON CONFLICT (customer_id, service_id) DO NOTHING
     RETURNING service_id`,
    [userId, serviceId],
  );
  if (result.rowCount === 0) {
    const existing = await database.query(
      `SELECT 1 FROM favorites WHERE customer_id = $1 AND service_id::text = $2`,
      [userId, serviceId],
    );
    if (existing.rowCount === 0) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }
  return NextResponse.json({ saved: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { serviceId } = await params;
  await database.query(
    `DELETE FROM favorites WHERE customer_id = $1 AND service_id::text = $2`,
    [userId, serviceId],
  );
  return NextResponse.json({ saved: false });
}
