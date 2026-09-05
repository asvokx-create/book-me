import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminSupportQueue from "@/components/admin-support-queue";
import { auth } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/admin/support");
  if (!await hasAdminAccess(session.user.id, session.user.email)) redirect("/");
  return <AdminSupportQueue />;
}
