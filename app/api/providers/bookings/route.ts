import { NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getProviderAccess } from "@/lib/provider-access";

export async function GET() {
  const access = await getProviderAccess();
  if (!access) return NextResponse.json({ error: "Provider or team access not found." }, { status: 404 });

  const result = await database.query<{
    id: string; customer: string; customer_image: string | null; service: string; starts_at: Date; location: string;
    price_cents: number; status: "requested" | "confirmed" | "completed" | "cancelled"; assignee_name: string; previous_booking_count: number; plan: "starter" | "pro" | "business" | "owner";
  }>(
    `SELECT b.id::text, u.name AS customer, u.image AS customer_image, s.title AS service, b.starts_at,
            b.service_address AS location, b.price_cents, b.status, p.plan,
            COALESCE((SELECT string_agg(CASE WHEN assigned.is_owner THEN owner_user.name ELSE assigned_member.name END, ', ' ORDER BY assigned.is_owner DESC, assigned_member.name)
              FROM booking_assignees assigned LEFT JOIN provider_team_members assigned_member ON assigned_member.id = assigned.team_member_id
              WHERE assigned.booking_id = b.id), COALESCE(member.name, owner_user.name)) AS assignee_name,
            (SELECT count(*)::int FROM bookings previous WHERE previous.provider_id = b.provider_id
              AND previous.customer_id = b.customer_id AND previous.id <> b.id
              AND previous.status IN ('confirmed', 'completed')) AS previous_booking_count
     FROM bookings b
     JOIN provider_profiles p ON p.id = b.provider_id
     JOIN "user" owner_user ON owner_user.id = p.user_id
     JOIN services s ON s.id = b.service_id
     JOIN "user" u ON u.id = b.customer_id
     LEFT JOIN provider_team_members member ON member.id = b.assigned_team_member_id
     WHERE p.id::text = $1 AND b.provider_deleted_at IS NULL
       AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM booking_assignees mine WHERE mine.booking_id = b.id AND mine.team_member_id = $2::uuid))
     ORDER BY CASE b.status WHEN 'requested' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
              b.starts_at ASC`,
    [access.providerId, access.isOwner ? null : access.memberId],
  );

  return NextResponse.json({ bookings: result.rows.map((row) => ({
    id: row.id,
    customer: row.customer,
    customerImage: row.customer_image ?? "",
    initials: row.customer.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""),
    service: row.service,
    startsAt: row.starts_at,
    location: row.location,
    price: row.price_cents / 100,
    status: row.status === "requested" ? "new" : row.status === "confirmed" ? "accepted" : row.status === "completed" ? "completed" : "cancelled",
    assigneeName: row.assignee_name,
    repeatBookings: row.plan === "starter" ? 0 : row.previous_booking_count,
  })) });
}
