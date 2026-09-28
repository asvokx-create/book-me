"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const requestsInFlight = new Set<string>();

function wasRecorded(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberRecorded(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // The server-set, httpOnly attribution cookie remains the source of truth.
  }
}

export default function AffiliateAttributionTracker() {
  const params = useSearchParams();
  const code = params.get("ref")?.trim() ?? "";
  useEffect(() => {
    if (!code) return;
    const key = `bubs-ref-recorded:${code}:${location.pathname}:${location.search}`;
    if (wasRecorded(key) || requestsInFlight.has(key)) return;
    requestsInFlight.add(key);
    void fetch("/api/affiliates/attribution", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ code, landingPath: `${location.pathname}${location.search}`,
        utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign"),
        utmContent: params.get("utm_content"), utmTerm: params.get("utm_term") }),
    }).then((response) => {
      if (response.ok) rememberRecorded(key);
    }).catch(() => undefined).finally(() => requestsInFlight.delete(key));
  }, [code, params]);
  return null;
}
