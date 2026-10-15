"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function GrowthAttributionTracker() {
  const params = useSearchParams();
  const { data: session } = authClient.useSession();
  const source = params.get("utm_source"), medium = params.get("utm_medium"), campaign = params.get("utm_campaign"), content = params.get("utm_content"), term = params.get("utm_term");
  useEffect(() => {
    if (!source && !medium && !campaign && !content && !term) return;
    void fetch("/api/growth/attribution", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ landingPath: `${location.pathname}${location.search}`, utmSource: source, utmMedium: medium, utmCampaign: campaign, utmContent: content, utmTerm: term }) }).catch(() => undefined);
  }, [source, medium, campaign, content, term]);
  useEffect(() => { if (session?.user) void fetch("/api/growth/attribution", { method: "PATCH", keepalive: true }).catch(() => undefined); }, [session?.user]);
  return null;
}
