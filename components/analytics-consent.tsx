"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type AnalyticsConsent = "granted" | "denied" | null;

export const ANALYTICS_CONSENT_KEY = "bubsbookings-analytics-consent";
export const ANALYTICS_CONSENT_EVENT = "bubsbookings:analytics-consent";
export const OPEN_ANALYTICS_CHOICES_EVENT = "bubsbookings:open-analytics-choices";

function readConsent(): AnalyticsConsent {
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function removeAnalyticsIdentifiers() {
  try {
    window.localStorage.removeItem("bubs-analytics-id");
  } catch {}

  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name === "_ga" || name?.startsWith("_ga_")) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.bubsbookings.com; SameSite=Lax`;
    }
  }
}

export function useAnalyticsConsent() {
  const subscribe = useCallback((update: () => void) => {
    window.addEventListener(ANALYTICS_CONSENT_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const consent = useSyncExternalStore<AnalyticsConsent | undefined>(subscribe, readConsent, () => undefined);
  return { consent };
}

export function analyticsAllowed() {
  return typeof window !== "undefined" && readConsent() === "granted";
}

export function AnalyticsConsentManager() {
  const { consent } = useAnalyticsConsent();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_ANALYTICS_CHOICES_EVENT, show);
    return () => window.removeEventListener(OPEN_ANALYTICS_CHOICES_EVENT, show);
  }, []);

  const choose = useCallback((choice: Exclude<AnalyticsConsent, null>) => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
    } catch {}
    if (choice === "denied") removeAnalyticsIdentifiers();
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
    setOpen(false);
  }, []);

  if (consent === undefined || (consent !== null && !open)) return null;

  return (
    <section aria-label="Analytics choices" className="fixed inset-x-3 bottom-3 z-[400] mx-auto max-w-3xl rounded-[1.5rem] border border-[#183126]/15 bg-[#fffefa] p-4 text-[#183126] shadow-[0_24px_80px_rgba(7,30,20,.28)] sm:bottom-5 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="text-base font-extrabold">Your analytics choice</h2>
          <p className="mt-1 text-sm leading-6 text-[#5f7168]">Optional browser analytics and Google Analytics help us understand how the marketplace is used. They stay off unless you allow them. Necessary sign-in, security, preferences, referral attribution, and account or transaction records are not changed by this choice. <Link href="/cookies" className="font-bold underline underline-offset-2">Cookie details</Link></p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 min-[430px]:flex-row">
          <button type="button" onClick={() => choose("denied")} className="min-h-11 rounded-full border border-[#183126]/20 bg-white px-5 py-2.5 text-sm font-bold hover:bg-[#edf1ec]">Continue without analytics</button>
          <button type="button" onClick={() => choose("granted")} className="min-h-11 rounded-full bg-[#183126] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#315846]">Allow analytics</button>
        </div>
      </div>
    </section>
  );
}

export function AnalyticsChoicesButton({ className = "" }: { className?: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_ANALYTICS_CHOICES_EVENT))} className={className}>Cookie choices</button>;
}
