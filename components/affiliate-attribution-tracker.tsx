"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AffiliateAttributionTracker() {
  const params = useSearchParams();
  const code = params.get("ref")?.trim() ?? "";
  useEffect(() => {
    if (!code) return;
    const key = `bubs-ref-recorded:${code}:${location.pathname}:${location.search}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void fetch("/api/affiliates/attribution", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ code, landingPath: `${location.pathname}${location.search}`,
        utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign"),
        utmContent: params.get("utm_content"), utmTerm: params.get("utm_term") }),
    }).catch(() => undefined);
  }, [code, params]);
  return null;
}
