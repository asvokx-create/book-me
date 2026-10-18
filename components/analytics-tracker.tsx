"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAnalyticsConsent } from "@/components/analytics-consent";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const { consent } = useAnalyticsConsent();

  useEffect(() => {
    if (consent !== "granted") return;
    let anonymousId = window.localStorage.getItem("bubs-analytics-id");
    if (!anonymousId) {
      anonymousId = window.crypto.randomUUID();
      window.localStorage.setItem("bubs-analytics-id", anonymousId);
    }
    // Query strings can contain a search term, an invite token, or other data
    // that is not needed for aggregate page-view reporting.
    const path = pathname;
    const serviceMatch = pathname.match(/^\/services\/([^/]+)$/);
    const providerMatch = pathname.match(/^\/(providers|companies)\/([^/]+)$/);
    const eventName = serviceMatch ? "service_view" : providerMatch ? "provider_profile_view" : "page_view";
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, anonymousId, path, metadata: serviceMatch ? { slug: serviceMatch[1] } : providerMatch ? { kind: providerMatch[1], slug: providerMatch[2] } : {} }),
      keepalive: true,
    });
  }, [consent, pathname]);

  return null;
}
