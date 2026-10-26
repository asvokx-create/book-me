export type AffiliateDeviceCategory = "mobile" | "tablet" | "desktop" | "unknown";
export type AffiliateBrowserCategory = "chrome" | "safari" | "firefox" | "edge" | "other" | "unknown";

export function classifyAffiliateTraffic(userAgent: unknown): {
  deviceCategory: AffiliateDeviceCategory;
  browserCategory: AffiliateBrowserCategory;
} {
  const value = typeof userAgent === "string" ? userAgent.slice(0, 500) : "";
  const lower = value.toLowerCase();
  const deviceCategory: AffiliateDeviceCategory = !value
    ? "unknown"
    : /ipad|tablet|kindle|silk/.test(lower)
      ? "tablet"
      : /mobile|iphone|ipod|android/.test(lower)
        ? "mobile"
        : "desktop";
  const browserCategory: AffiliateBrowserCategory = !value
    ? "unknown"
    : /edg\//.test(lower)
      ? "edge"
      : /firefox|fxios/.test(lower)
        ? "firefox"
        : /chrome|crios/.test(lower)
          ? "chrome"
          : /safari/.test(lower)
            ? "safari"
            : "other";
  return { deviceCategory, browserCategory };
}
