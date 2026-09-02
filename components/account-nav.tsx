"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AccountNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  if (isPending) {
    return <div aria-label="Loading account" className="h-10 w-28 animate-pulse rounded-full bg-[#183126]/8" />;
  }

  if (session) {
    const name = session.user.name?.trim() || "My account";
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
    return (
      <div className="flex items-center gap-2">
        <Link href="/account" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-[#183126]/5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e6eedf] text-xs font-bold">{initials}</span>
          <span className="hidden sm:inline">My account</span>
        </Link>
        <button type="button" onClick={signOut} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#697970] transition hover:bg-[#183126]/5 md:block">Log out</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-[#183126]/5 sm:px-4">Log in</Link>
      <Link href="/signup" className="rounded-full bg-[#183126] px-4 py-2.5 text-sm font-semibold text-white sm:px-5">Sign up</Link>
    </div>
  );
}
