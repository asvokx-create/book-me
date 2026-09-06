"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    let anonymousId = window.localStorage.getItem("bubs-analytics-id");
    if (!anonymousId) {
      anonymousId = window.crypto.randomUUID();
      window.localStorage.setItem("bubs-analytics-id", anonymousId);
    }
    const path = `${pathname}${query ? `?${query}` : ""}`;
    const serviceMatch = pathname.match(/^\/services\/([^/]+)$/);
    const eventName = serviceMatch ? "service_view" : pathname === "/services" && query ? "search_results" : "page_view";
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, anonymousId, path, metadata: serviceMatch ? { slug: serviceMatch[1] } : {} }),
      keepalive: true,
    });
  }, [pathname, query]);

  return null;
}
