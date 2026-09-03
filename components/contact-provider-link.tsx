"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function ContactProviderLink({ providerId, serviceId, className }: { providerId: string; serviceId?: string; className?: string }) {
  const { data: session } = authClient.useSession();
  const destination = `/account/messages?providerId=${encodeURIComponent(providerId)}${serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : ""}`;
  const href = session ? destination : `/login?redirect=${encodeURIComponent(destination)}`;
  return <Link href={href} className={className}>✉ Contact provider</Link>;
}
