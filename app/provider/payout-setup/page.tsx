import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isAuthConfigured } from "@/lib/auth";

const billingPath = "/provider/dashboard/billing";

export default async function ProviderPayoutSetupPage() {
  if (isAuthConfigured()) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect(`/login?redirect=${encodeURIComponent(billingPath)}`);
  }
  redirect(billingPath);
}
