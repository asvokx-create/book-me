import { NextResponse } from "next/server";
import { createCalendlyAuthorization } from "@/lib/calendly";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit } from "@/lib/request-security";
import { publicRequestOrigin } from "@/lib/request-origin";

export async function GET(request: Request) {
  const access = await getProviderAccess();
  if (!access?.isOwner) return NextResponse.json({ error: "Only the provider account owner can connect Calendly." }, { status: 403 });
  if (!await enforceRateLimit({ request, userId: access.session.user.id, bucket: "calendly-connect", limit: 5 })) {
    return NextResponse.json({ error: "Please wait before trying to connect Calendly again." }, { status: 429 });
  }
  try {
    return NextResponse.redirect(await createCalendlyAuthorization(access.providerId));
  } catch (error) {
    const url = new URL("/provider/dashboard/calendar", publicRequestOrigin(request));
    url.searchParams.set("calendly", "configuration_error");
    console.error("Calendly connection could not start", { providerId: access.providerId, error });
    return NextResponse.redirect(url);
  }
}
