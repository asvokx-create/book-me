"use client";

import { useEffect } from "react";
import { useAnalyticsConsent } from "@/components/analytics-consent";

export default function SearchResultsAnalytics({ query, category, delivery = "ALL", location, radiusMiles, resultCount }: { query: string; category: string; delivery?: string; location: string; radiusMiles: number; resultCount: number }) {
  const { consent } = useAnalyticsConsent();
  useEffect(() => {
    if (consent !== "granted") return;
    let anonymousId = window.localStorage.getItem("bubs-analytics-id");
    if (!anonymousId) {
      anonymousId = window.crypto.randomUUID();
      window.localStorage.setItem("bubs-analytics-id", anonymousId);
    }
    // Search text can include personal information. The reporting endpoint only
    // needs aggregate context, not the text a visitor typed.
    const metadata = { queryLength: query.trim().length, category, delivery, ...(delivery === "REMOTE" ? {} : { location, radiusMiles }), resultCount };
    const eventName = resultCount === 0 ? "zero_result_search" : delivery === "REMOTE" ? "remote_search" : delivery === "IN_PERSON" ? "local_search" : "search_results";
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName, anonymousId, path: window.location.pathname, metadata }), keepalive: true });
  }, [category, consent, delivery, location, query, radiusMiles, resultCount]);
  return null;
}
