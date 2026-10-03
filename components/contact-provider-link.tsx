"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import UiIcon from "@/components/ui-icon";

export default function ContactProviderLink({ providerId, serviceId, className }: { providerId: string; serviceId?: string; className?: string }) {
  const { data: session } = authClient.useSession();
  const destination = `/account/messages?providerId=${encodeURIComponent(providerId)}${serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : ""}`;
  const href = session ? destination : `/login?redirect=${encodeURIComponent(destination)}`;
  return <Link href={href} className={`${className ?? ""} inline-flex items-center gap-2`}><UiIcon name="mail" className="h-4 w-4" />Contact provider</Link>;
}
