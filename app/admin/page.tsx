import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/admin-dashboard";
import { hasAdminAccess } from "@/lib/admin";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/admin");
  if (!await hasAdminAccess(session.user.id, session.user.email)) redirect("/");
  return <AdminDashboard adminName={session.user.name || "BubsBookings admin"} />;
}
