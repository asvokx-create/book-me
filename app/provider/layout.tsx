import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProviderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (isAuthConfigured()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");
  }

  return children;
}
