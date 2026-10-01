"use client";

import { useEffect } from "react";

export default function SearchResultsAnalytics({ query, category, delivery = "ALL", location, radiusMiles, resultCount }: { query: string; category: string; delivery?: string; location: string; radiusMiles: number; resultCount: number }) {
  useEffect(() => {
    let anonymousId = window.localStorage.getItem("bubs-analytics-id");
    if (!anonymousId) {
      anonymousId = window.crypto.randomUUID();
      window.localStorage.setItem("bubs-analytics-id", anonymousId);
    }
    const metadata = { query, category, delivery, ...(delivery === "REMOTE" ? {} : { location, radiusMiles }), resultCount };
    const eventName = resultCount === 0 ? "zero_result_search" : delivery === "REMOTE" ? "remote_search" : delivery === "IN_PERSON" ? "local_search" : "search_results";
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName, anonymousId, path: window.location.pathname + window.location.search, metadata }), keepalive: true });
  }, [category, delivery, location, query, radiusMiles, resultCount]);
  return null;
}
