"use client";

import { MouseEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const favoriteCache = new Map<string, Promise<Set<string>>>();

function getFavoriteIds(userId: string) {
  if (!favoriteCache.has(userId)) {
    favoriteCache.set(userId, fetch("/api/favorites")
      .then(async (response) => response.ok ? response.json() as Promise<{ serviceIds: string[] }> : { serviceIds: [] })
      .then((result) => new Set(result.serviceIds)));
  }
  return favoriteCache.get(userId)!;
}

export default function FavoriteButton({ serviceId, serviceTitle, className = "", onChange }: { serviceId: string; serviceTitle: string; className?: string; onChange?: (saved: boolean) => void }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (session?.user.id) {
      getFavoriteIds(session.user.id).then((ids) => { if (active) setSaved(ids.has(serviceId)); });
    }
    return () => { active = false; };
  }, [serviceId, session?.user.id]);

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!session) {
      router.push("/login");
      return;
    }
    if (saving) return;

    setSaving(true);
    const nextSaved = !saved;
    const response = await fetch(`/api/favorites/${serviceId}`, { method: nextSaved ? "POST" : "DELETE" });
    setSaving(false);
    if (!response.ok) return;

    setSaved(nextSaved);
    const ids = await getFavoriteIds(session.user.id);
    if (nextSaved) ids.add(serviceId); else ids.delete(serviceId);
    onChange?.(nextSaved);
  }

  return (
    <button type="button" onClick={toggle} disabled={saving || sessionPending} aria-label={`${saved ? "Remove" : "Save"} ${serviceTitle}`} aria-pressed={saved} className={`grid place-items-center transition hover:scale-105 disabled:cursor-wait disabled:opacity-60 ${saved ? "text-[#b54e46]" : "text-[#183126]"} ${className}`}>
      <span aria-hidden="true" className="text-xl">{saved ? "♥" : "♡"}</span>
    </button>
  );
}
