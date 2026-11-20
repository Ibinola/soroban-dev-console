/**
 * Permalinks for contract call results. A link carries the network, method,
 * argument values and (optionally) the observed result, so the recipient can
 * reopen the same call and see what the sender saw. The result is display-only:
 * it is never executed or trusted.
 */
export const MAX_SHARED_RESULT_CHARS = 2000;
const MAX_ARGS = 32;

export interface CallPermalink {
  contractId: string;
  network: string;
  fnName: string;
  args: string[];
  result?: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bin = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function buildCallPermalink(origin: string, link: CallPermalink): string {
  const url = new URL(`/contracts/${encodeURIComponent(link.contractId)}`, origin);
  url.searchParams.set("network", link.network);
  url.searchParams.set("method", link.fnName);
  if (link.args.length > 0) url.searchParams.set("args", toBase64Url(JSON.stringify(link.args)));
  if (link.result) {
    url.searchParams.set("result", toBase64Url(link.result.slice(0, MAX_SHARED_RESULT_CHARS)));
  }
  return url.toString();
}

/** Parses the call-related query parameters; unknown or malformed values are dropped. */
export function parseCallPermalink(
  params: Pick<URLSearchParams, "get">,
): { fnName: string | null; args: string[] | null; result: string | null } {
  const fnName = params.get("method");

  let args: string[] | null = null;
  const rawArgs = params.get("args");
  if (rawArgs) {
    try {
      const parsed: unknown = JSON.parse(fromBase64Url(rawArgs));
      if (
        Array.isArray(parsed) &&
        parsed.length <= MAX_ARGS &&
        parsed.every((v) => typeof v === "string")
      ) {
        args = parsed as string[];
      }
    } catch {
      args = null;
    }
  }

  let result: string | null = null;
  const rawResult = params.get("result");
  if (rawResult) {
    try {
      result = fromBase64Url(rawResult).slice(0, MAX_SHARED_RESULT_CHARS);
    } catch {
      result = null;
    }
  }

  return { fnName, args, result };
}
