"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import NotificationBell from "@/components/notification-bell";
import ProfileAvatar from "@/components/profile-avatar";

export default function AccountNav() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <div aria-label="Loading account" className="h-10 w-28 animate-pulse rounded-full bg-[#183126]/8" />;
  }

  if (session) {
    const name = session.user.name?.trim() || "My account";
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link href="/account" className="flex items-center gap-2 rounded-full border border-[#183126]/8 bg-white/70 px-2.5 py-1.5 text-sm font-semibold shadow-sm backdrop-blur transition hover:border-[#183126]/15 hover:bg-white hover:shadow-md sm:px-3">
          <ProfileAvatar name={name} imageUrl={session.user.image} className="h-8 w-8 text-xs" />
          <span className="hidden sm:inline">My account</span>
        </Link>
        <NotificationBell />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link href="/login" className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold hover:bg-white min-[380px]:inline-flex sm:px-4">Log in</Link>
      <Link href="/signup" className="whitespace-nowrap rounded-full bg-[#173d2e] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(23,61,46,.18)] hover:bg-[#265842] sm:px-5">Sign up</Link>
    </div>
  );
}
