import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFavoriteServices } from "@/lib/marketplace";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const services = await getFavoriteServices(session.user.id);
  return NextResponse.json({
    serviceIds: services.map((service) => service.id),
    services,
  });
}
