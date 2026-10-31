function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() ?? "";
}

function normalizedOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function hostOrigin(request: Request) {
  const host = firstHeaderValue(request.headers.get("x-forwarded-host"))
    || firstHeaderValue(request.headers.get("host"));
  if (!host || /[\s/\\]/.test(host)) return null;

  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol === "https" || forwardedProtocol === "http"
    ? forwardedProtocol
    : new URL(request.url).protocol.replace(":", "");
  return normalizedOrigin(`${protocol}://${host}`);
}

/**
 * Returns the public application origin for redirects generated behind a
 * reverse proxy. Prefer the configured canonical URL so an internal runtime
 * address such as localhost:8080 can never leak into a browser redirect.
 */
export function publicRequestOrigin(request: Request) {
  return normalizedOrigin(process.env.NEXT_PUBLIC_APP_URL)
    ?? normalizedOrigin(process.env.BETTER_AUTH_URL)
    ?? hostOrigin(request)
    ?? new URL(request.url).origin;
}

/**
 * Validates browser mutation requests after a reverse proxy has terminated TLS.
 * DigitalOcean preserves the public host and protocol in forwarded headers even
 * when the application receives an internal HTTP request URL.
 */
export function hasTrustedRequestOrigin(request: Request) {
  const suppliedOrigin = normalizedOrigin(request.headers.get("origin") ?? undefined);
  if (!suppliedOrigin) return false;

  const trustedOrigins = new Set([
    normalizedOrigin(process.env.NEXT_PUBLIC_APP_URL),
    normalizedOrigin(process.env.BETTER_AUTH_URL),
    hostOrigin(request),
    new URL(request.url).origin,
  ].filter((origin): origin is string => Boolean(origin)));

  return trustedOrigins.has(suppliedOrigin);
}
