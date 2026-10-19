export type ProviderJoinSearchParams = Record<string, string | string[] | undefined>;

export const providerTrackingKeys = ["ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function buildProviderJoinDestination(params: ProviderJoinSearchParams) {
  const requestedPlan = first(params.plan).toLowerCase();
  const plan = requestedPlan === "pro" ? "pro" : requestedPlan === "starter" ? "starter" : "";
  const preserved = new URLSearchParams();
  if (plan) preserved.set("plan", plan);
  for (const key of providerTrackingKeys) {
    const value = first(params[key]).trim().slice(0, 160);
    if (!value) continue;
    if (key === "ref" && !/^[A-Za-z0-9_-]{3,32}$/.test(value)) continue;
    preserved.set(key, key === "ref" ? value.toUpperCase() : value);
  }
  const query = preserved.toString();
  return { plan, returnPath: `/providers/join${query ? `?${query}` : ""}`, preserved };
}

export function buildProviderAuthHref(path: "/signup" | "/login", returnPath: string, preserved: URLSearchParams) {
  const authParams = new URLSearchParams({ redirect: returnPath });
  for (const key of providerTrackingKeys) {
    const value = preserved.get(key);
    if (value) authParams.set(key, value);
  }
  return `${path}?${authParams.toString()}`;
}
