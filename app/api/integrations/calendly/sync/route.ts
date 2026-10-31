import { NextResponse } from "next/server";
import { syncCalendlyConnection } from "@/lib/calendly";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit, recordActivity } from "@/lib/request-security";

export async function POST(request: Request) {
  const access = await getProviderAccess();
  if (!access?.isOwner) return NextResponse.json({ error: "Only the provider account owner can synchronize Calendly." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: access.session.user.id, bucket: "calendly-sync", limit: 5 })) {
    return NextResponse.json({ error: "Please wait a minute before synchronizing again." }, { status: 429 });
  }
  const result = await database.query<{ id: string }>("SELECT id::text FROM provider_calendly_connections WHERE provider_id::text=$1 AND disconnected_at IS NULL", [access.providerId]);
  if (!result.rows[0]) return NextResponse.json({ error: "Calendly is not connected." }, { status: 404 });
  try {
    await syncCalendlyConnection(result.rows[0].id);
    await recordActivity({ userId: access.session.user.id, action: "calendly_synchronized", targetType: "provider", targetId: access.providerId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Calendly manual sync failed", { providerId: access.providerId, error });
    return NextResponse.json({ error: "Calendly could not be synchronized. Reconnect the account if access was revoked." }, { status: 502 });
  }
}
