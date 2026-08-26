/**
 * middleware.ts  (apps/web/middleware.ts)
 *
 * Issue #939: Add Content Security Policy (CSP) headers in Next.js web app.
 *
 * Implements a strict, nonce-based CSP that:
 *  - Generates a cryptographically-random per-request nonce.
 *  - Injects the nonce into the CSP header via `script-src` so only
 *    nonce-tagged <script> elements execute (no unsafe-inline).
 *  - Restricts `connect-src` to the API backend and authorised
 *    Stellar RPC / Horizon / Friendbot domains.
 *  - Makes the nonce available to layout.tsx via the `x-nonce` response
 *    header (read via `headers()` in server components).
 *
 * Usage in layout.tsx
 * -------------------
 *   import { headers } from "next/headers";
 *
 *   const nonce = (await headers()).get("x-nonce") ?? "";
 *   // Pass nonce to <script> tags:
 *   <script nonce={nonce} ... />
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── Allowed external connect-src origins ─────────────────────────────────────

const STELLAR_CONNECT_ORIGINS = [
  // Horizon APIs
  "https://horizon.stellar.org",
  "https://horizon-testnet.stellar.org",
  "https://horizon-futurenet.stellar.org",
  // RPC nodes
  "https://soroban-testnet.stellar.org",
  "https://rpc-mainnet.stellar.org",
  "https://rpc-futurenet.stellar.org",
  // Friendbot
  "https://friendbot.stellar.org",
  "https://friendbot-testnet.stellar.org",
  // Albedo wallet
  "https://albedo.link",
  // Freighter extension communicates via postMessage (same origin)
].join(" ");

// ─── CSP builder ──────────────────────────────────────────────────────────────

function buildCsp(nonce: string, isDev: boolean): string {
  const self = "'self'";
  const none = "'none'";
  const nonceSrc = `'nonce-${nonce}'`;
  // In development allow eval for Next.js HMR / fast refresh
  const scriptSrc = isDev
    ? `${self} ${nonceSrc} 'unsafe-eval'`
    : `${self} ${nonceSrc}`;

  const directives: Record<string, string> = {
    "default-src":     self,
    "script-src":      scriptSrc,
    // Tailwind and radix emit inline styles; unsafe-inline is required for styles
    "style-src":       `${self} 'unsafe-inline'`,
    "img-src":         `${self} data: blob: https:`,
    "font-src":        `${self} data:`,
    // API backend (same origin) + authorised Stellar domains
    "connect-src":     `${self} ${STELLAR_CONNECT_ORIGINS} ws://localhost:* wss://localhost:*`,
    "frame-src":       `${self} https://albedo.link`,
    "frame-ancestors": self,
    "object-src":      none,
    "base-uri":        self,
    "form-action":     self,
    "upgrade-insecure-requests": "",
  };

  return Object.entries(directives)
    .map(([key, value]) => (value ? `${key} ${value}` : key))
    .join("; ");
}

// ─── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);

  const response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Expose nonce to server components via request header
  response.headers.set("x-nonce", nonce);

  // Set CSP response header
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  /*
   * Apply middleware to all routes except:
   *  - _next/static  — compiled assets
   *  - _next/image   — image optimisation endpoint
   *  - favicon.ico   — browser favicon
   *  - api/          — API routes handle their own security headers in NestJS
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
