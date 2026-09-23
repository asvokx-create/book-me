"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "bubsbookings-location-reminder-dismissed-at";
const REMIND_AGAIN_AFTER = 7 * 24 * 60 * 60 * 1000;

export default function AccountLocationReminder() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (Date.now() - dismissedAt < REMIND_AGAIN_AFTER) return;
    let active = true;
    fetch("/api/account/settings", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ locationComplete?: boolean }> : null)
      .then((data) => { if (active && data && !data.locationComplete) setVisible(true); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!visible) return null;
  return <section className="mb-7 flex flex-col gap-4 rounded-3xl border border-[#d2c54b]/45 bg-[#fff8cb] p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Complete your account location">
    <div><h2 className="font-bold">Complete your general account location</h2><p className="mt-1 text-sm leading-6 text-[#5f6f67]">Add your city, state, ZIP, and country so BubsBookings can use the right default area. You can change it at any time.</p></div>
    <div className="flex shrink-0 flex-wrap gap-2"><Link href="/account/settings#account-location" className="rounded-full bg-[#183126] px-5 py-3 text-sm font-bold text-white">Add location</Link><button type="button" onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setVisible(false); }} className="rounded-full border border-[#183126]/20 px-4 py-3 text-sm font-bold">Later</button></div>
  </section>;
}
