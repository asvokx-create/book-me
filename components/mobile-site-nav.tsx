"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { authClient } from "@/lib/auth-client";
import { getMobileNavigationState } from "@/lib/mobile-navigation-state";

const links = [
  ["Find services", "/services"],
  ["Request a service", "/requests"],
  ["Guides", "/guides"],
  ["Provider pricing", "/pricing"],
  ["Service areas", "/locations"],
  ["Our promise", "/promise"],
] as const;

export default function MobileSiteNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [adminAccess, setAdminAccess] = useState<{ userId: string; isAdmin: boolean } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    let active = true;
    const userId = session.user.id;
    void fetch("/api/account/navigation", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean; isAdmin: boolean }> : null)
      .then((result) => {
        if (active) setAdminAccess({ userId, isAdmin: Boolean(result?.authenticated && result.isAdmin) });
      })
      .catch(() => {
        if (active) setAdminAccess({ userId, isAdmin: false });
      });
    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const navigationState = getMobileNavigationState({
    isPending,
    authenticated: Boolean(session),
    role: session?.user.role,
    isAdmin: Boolean(session?.user.id && adminAccess?.userId === session.user.id && adminAccess.isAdmin),
  });

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await authClient.signOut();
    setOpen(false);
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

  return <>
    <button type="button" aria-label="Open navigation menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#183126]/10 bg-white/75 text-xl font-bold shadow-sm lg:hidden">☰</button>
    {open && createPortal(<div className="fixed inset-0 z-[200] bg-[#10251c]/55 backdrop-blur-sm lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <nav aria-label="Mobile navigation" className="absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col overflow-y-auto bg-[#f8f7f3] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#183126]/10 pb-4">
          <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#66796f]">Explore BubsBookings</p>
          <button ref={closeButtonRef} type="button" aria-label="Close navigation menu" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-2xl shadow-sm">×</button>
        </div>
        <div className="grid gap-2 py-5">
          {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-between rounded-2xl px-4 py-3 text-base font-bold hover:bg-[#e5eddf]">{label}<span aria-hidden="true">→</span></Link>)}
        </div>
        <div className="mt-auto grid gap-3 border-t border-[#183126]/10 pt-5">
          {navigationState.status === "loading" && <div aria-label="Loading account" className="grid gap-3" aria-live="polite"><span className="h-12 animate-pulse rounded-full bg-[#183126]/8" /><span className="h-12 animate-pulse rounded-full bg-[#183126]/8" /></div>}
          {navigationState.showAccount && <Link href="/account" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-5 py-3 font-bold">Account</Link>}
          {navigationState.showProviderDashboard && <Link href="/provider/dashboard" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-5 py-3 font-bold">Provider dashboard</Link>}
          {navigationState.showAdminDashboard && <Link href="/admin" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-5 py-3 font-bold">Admin dashboard</Link>}
          {navigationState.showLogout && <button type="button" disabled={signingOut} onClick={() => void signOut()} className="flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-5 py-3 font-bold disabled:cursor-wait disabled:opacity-60">{signingOut ? "Logging out…" : "Log out"}</button>}
          {navigationState.showLogin && <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-full border border-[#183126]/15 bg-white px-5 py-3 font-bold">Log in</Link>}
          {navigationState.showCreateAccount && <Link href="/signup" onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-center rounded-full bg-[#eee25a] px-5 py-3 font-bold">Create account</Link>}
        </div>
      </nav>
    </div>, document.body)}
  </>;
}
