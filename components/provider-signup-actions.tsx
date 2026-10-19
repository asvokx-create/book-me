"use client";

import Link from "next/link";

function record(eventName: "signup_clicked" | "signup_started") {
  const send = () => fetch("/api/affiliates/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventName }),
  });
  void send().then(async (response) => {
    const result = await response.json().catch(() => null) as { ignored?: boolean } | null;
    if (result?.ignored && eventName === "signup_started") setTimeout(() => { void send().catch(() => undefined); }, 500);
  }).catch(() => undefined);
}

export function ProviderSignupButton({ href, compact = false }: { href: string; compact?: boolean }) {
  return <Link href={href} onClick={() => record("signup_clicked")}
    className={compact
      ? "inline-flex min-h-11 items-center justify-center rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126]"
      : "mt-7 flex min-h-12 w-full items-center justify-center rounded-full bg-[#eee25a] px-6 py-3.5 font-bold text-[#183126]"}>
    Create provider account
  </Link>;
}

export function recordProviderSignupStarted() {
  record("signup_started");
}

export function recordProviderOnboardingStarted() {
  void fetch("/api/affiliates/funnel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventName: "onboarding_started" }),
  }).catch(() => undefined);
}
