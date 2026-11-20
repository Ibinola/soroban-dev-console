/**
 * sri-manifest.ts
 *
 * Issue #952: Add SRI (Subresource Integrity) hashes to external script/stylesheet assets.
 *
 * This manifest centralises all third-party external resources loaded by the
 * application along with their SHA-384 integrity hashes and crossorigin
 * attributes.  Using a manifest makes it easy to audit and update hashes
 * when dependencies are upgraded.
 *
 * Usage — in a Next.js layout or page:
 *
 *   import { SriScript, SriStylesheet } from "@/lib/sri-manifest";
 *
 *   // In <head>:
 *   <SriStylesheet name="inter-font" />
 *   <SriScript name="some-analytics" defer />
 *
 * Generating hashes
 * -----------------
 * To generate the SHA-384 hash for a new asset run:
 *
 *   curl -sL <URL> | openssl dgst -sha384 -binary | openssl base64 -A
 *
 * Then prefix the result with `sha384-` and add it to the manifest below.
 *
 * Security notes
 * --------------
 *  - Always use `crossorigin="anonymous"` with SRI so the browser can
 *    compare the hash without sending credentials.
 *  - For assets served from your own origin, SRI is optional but still
 *    recommended as a defence-in-depth measure.
 *  - Regenerate hashes whenever an external library is upgraded.
 */

import React from "react";

// ─── Manifest types ───────────────────────────────────────────────────────────

export interface SriAsset {
  /** Publicly accessible URL of the asset. */
  url: string;
  /**
   * SHA-384 integrity hash in the format `sha384-<base64>`.
   * Multiple hashes can be space-separated for upgrade grace periods.
   */
  integrity: string;
  /** CORS mode — must be "anonymous" for SRI to work cross-origin. */
  crossOrigin: "anonymous" | "use-credentials";
  /** Human-readable description for auditing purposes. */
  description?: string;
}

// ─── Asset manifest ───────────────────────────────────────────────────────────

/**
 * Manifest of all external scripts loaded by the application.
 *
 * Currently the application bundles all JavaScript internally (Next.js/Webpack)
 * so there are no third-party `<script>` tags to register.  Add entries here
 * as third-party scripts are introduced (e.g. analytics, monitoring).
 *
 * Example entry:
 *
 *   "sentry-sdk": {
 *     url: "https://browser.sentry-cdn.com/7.0.0/bundle.min.js",
 *     integrity: "sha384-<hash>",
 *     crossOrigin: "anonymous",
 *     description: "Sentry error monitoring SDK",
 *   }
 */
export const SRI_SCRIPTS: Record<string, SriAsset> = {
  // No external scripts currently — all JS is self-hosted via Next.js bundler.
  // Register third-party scripts here when they are introduced.
};

/**
 * Manifest of all external stylesheets loaded by the application.
 *
 * The app uses Tailwind CSS compiled locally, so there are no CDN stylesheets
 * at this time.  Add entries as external CSS resources are introduced.
 *
 * Example entry:
 *
 *   "inter-font": {
 *     url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
 *     integrity: "sha384-<hash>",
 *     crossOrigin: "anonymous",
 *     description: "Inter variable font from Google Fonts",
 *   }
 */
export const SRI_STYLESHEETS: Record<string, SriAsset> = {
  // No external stylesheets currently — all CSS is compiled locally via Tailwind.
  // Register third-party stylesheets here when they are introduced.
};

// ─── React helpers ────────────────────────────────────────────────────────────

interface SriScriptProps extends React.HTMLAttributes<HTMLScriptElement> {
  /** Key in SRI_SCRIPTS manifest. */
  name: string;
  defer?: boolean;
  async?: boolean;
}

/**
 * Render a `<script>` tag with SRI attributes from the manifest.
 * Returns `null` when the key is not found so the page never breaks silently.
 */
export function SriScript({ name, ...rest }: SriScriptProps) {
  const asset = SRI_SCRIPTS[name];
  if (!asset) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[SRI] No manifest entry found for script: "${name}"`);
    }
    return null;
  }

  return (
    <script
      src={asset.url}
      integrity={asset.integrity}
      crossOrigin={asset.crossOrigin}
      {...rest}
    />
  );
}

interface SriStylesheetProps {
  /** Key in SRI_STYLESHEETS manifest. */
  name: string;
}

/**
 * Render a `<link rel="stylesheet">` tag with SRI attributes from the manifest.
 * Returns `null` when the key is not found.
 */
export function SriStylesheet({ name }: SriStylesheetProps) {
  const asset = SRI_STYLESHEETS[name];
  if (!asset) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[SRI] No manifest entry found for stylesheet: "${name}"`);
    }
    return null;
  }

  return (
    <link
      rel="stylesheet"
      href={asset.url}
      integrity={asset.integrity}
      crossOrigin={asset.crossOrigin}
    />
  );
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

/**
 * Return all registered SRI assets (scripts + stylesheets) for auditing.
 * Useful in CI scripts or documentation generators.
 */
export function getAllSriAssets(): Array<SriAsset & { type: "script" | "stylesheet"; name: string }> {
  const scripts = Object.entries(SRI_SCRIPTS).map(([name, asset]) => ({
    ...asset,
    type: "script" as const,
    name,
  }));
  const stylesheets = Object.entries(SRI_STYLESHEETS).map(([name, asset]) => ({
    ...asset,
    type: "stylesheet" as const,
    name,
  }));
  return [...scripts, ...stylesheets];
}
