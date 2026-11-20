import { NextResponse, type NextRequest } from "next/server";

/**
 * Issue #946: Enforce HTTPS in production (redirect + HSTS).
 * Issue #947: Standard OWASP security response headers.
 */
export function middleware(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto");
  const isProduction = process.env.NODE_ENV === "production";

  // Issue #946: redirect plain HTTP to HTTPS in production. Behind most
  // hosting proxies TLS is terminated upstream, so we rely on the
  // x-forwarded-proto header set by the proxy rather than request.url's scheme.
  if (isProduction && proto === "http") {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 308);
  }

  const response = NextResponse.next();

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  // Issue #947: OWASP-recommended security headers on every response.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
