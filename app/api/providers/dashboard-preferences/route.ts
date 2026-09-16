import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";
import { enforceRateLimit } from "@/lib/request-security";
import { availableDashboardWidgets, normalizeDashboardWidgets, type DashboardWidgetId } from "@/lib/provider-dashboard-widgets";

export async function GET() {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider access required." }, { status: 401 });

  const result = await database.query<{ provider_dashboard_widgets: unknown }>(
    "SELECT provider_dashboard_widgets FROM user_settings WHERE user_id = $1",
    [access.session.user.id],
  );
  return NextResponse.json({ widgets: normalizeDashboardWidgets(result.rows[0]?.provider_dashboard_widgets, access.isOwner) });
}

export async function PUT(request: Request) {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider access required." }, { status: 401 });
  if (!await enforceRateLimit({ request, userId: access.session.user.id, bucket: "provider-dashboard-preferences", limit: 20 })) {
    return NextResponse.json({ error: "Too many dashboard changes. Please wait a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as { widgets?: unknown } | null;
  const available = availableDashboardWidgets(access.isOwner);
  if (!Array.isArray(body?.widgets) || body.widgets.length < 1 || body.widgets.length > available.length) {
    return NextResponse.json({ error: "Choose at least one available widget." }, { status: 400 });
  }
  const widgets = body.widgets as unknown[];
  const valid = widgets.every((item) => typeof item === "string" && available.includes(item as DashboardWidgetId));
  const unique = new Set(widgets).size === widgets.length;
  if (!valid || !unique) return NextResponse.json({ error: "That dashboard layout is not available for this account." }, { status: 400 });

  await database.query(
    `INSERT INTO user_settings (user_id, provider_dashboard_widgets)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET provider_dashboard_widgets = EXCLUDED.provider_dashboard_widgets`,
    [access.session.user.id, JSON.stringify(widgets)],
  );
  return NextResponse.json({ widgets });
}
