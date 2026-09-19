"use client";

import { useEffect } from "react";

export default function SearchResultsAnalytics({ query, category, location, radiusMiles, resultCount }: { query: string; category: string; location: string; radiusMiles: number; resultCount: number }) {
  useEffect(() => {
    let anonymousId = window.localStorage.getItem("bubs-analytics-id");
    if (!anonymousId) {
      anonymousId = window.crypto.randomUUID();
      window.localStorage.setItem("bubs-analytics-id", anonymousId);
    }
    const metadata = { query, category, location, radiusMiles, resultCount };
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventName: resultCount === 0 ? "zero_result_search" : "search_results", anonymousId, path: window.location.pathname + window.location.search, metadata }), keepalive: true });
  }, [category, location, query, radiusMiles, resultCount]);
  return null;
}
