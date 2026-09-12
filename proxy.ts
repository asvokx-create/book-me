import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const JSON_BODY_LIMIT = 1024 * 1024;
const UPLOAD_BODY_LIMIT = 12 * 1024 * 1024;

function trustedOrigins(request: NextRequest) {
  const values = [
    request.nextUrl.origin,
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "https://bubsbookings.com",
    "https://www.bubsbookings.com",
    ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3001"]),
  ];
  return new Set(values.filter((value): value is string => Boolean(value)).map((value) => {
    try { return new URL(value).origin; } catch { return ""; }
  }).filter(Boolean));
}

function isUploadPath(pathname: string) {
  return pathname === "/api/account/profile-photo" || /^\/api\/providers\/services\/[^/]+\/images$/.test(pathname);
}

export function proxy(request: NextRequest) {
  if (!SAFE_METHODS.has(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") {
      return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
    }

    const origin = request.headers.get("origin");
    if (origin) {
      let normalizedOrigin = "";
      try { normalizedOrigin = new URL(origin).origin; } catch { /* Invalid origins are rejected below. */ }
      if (!normalizedOrigin || !trustedOrigins(request).has(normalizedOrigin)) {
        return NextResponse.json({ error: "This request did not come from BubsBookings." }, { status: 403 });
      }
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      const maximumBytes = isUploadPath(request.nextUrl.pathname) ? UPLOAD_BODY_LIMIT : JSON_BODY_LIMIT;
      if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maximumBytes) {
        return NextResponse.json({ error: "The request is too large." }, { status: 413 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
