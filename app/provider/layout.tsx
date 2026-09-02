import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProviderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (isAuthConfigured()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
  }

  return children;
}
