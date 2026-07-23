"use client";

/**
 * W7-FE-002: Reusable XdrTooltip component.
 *
 * Wraps any children element so that on hover (or keyboard focus) a
 * decoded-JSON snapshot of the underlying XDR string is shown in a
 * popover.
 *
 * - Lazy: decoding happens inside `useMemo` keyed off the open state so
 *   we don't pay the XDR parse cost for every XDR surface on every
 *   render.
 * - Auto-detect: when `kind === "auto"` (default) we try a small list
 *   of base64 parsers in order until one succeeds. Otherwise we only
 *   attempt the requested kind.
 * - Resilient: invalid XDR shows a friendly error in the popover so the
 *   raw string remains intact underneath.
 * - A11y: uses the Radix Tooltip primitive so the popover is reachable
 *   by keyboard focus and announced by screen readers.
 */

import {
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { xdr } from "@stellar/stellar-sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@devconsole/ui";
import { AlertTriangle, Braces, Loader2 } from "lucide-react";

export type XdrKind =
  | "auto"
  | "envelope"
  | "result"
  | "meta"
  | "scval"
  | "ledgerEntry"
  | "sorobanAuth";

export interface XdrTooltipProps {
  /** Raw base64 XDR string. If empty, renders children only. */
  value?: string | null;
  /** Preferred parser — defaults to "auto" (try in order). */
  kind?: XdrKind;
  /** Element(s) to make hoverable / focusable. */
  children: ReactNode;
  /** Optional class name applied to the trigger span. */
  className?: string;
  /** Cap popover width (default 480px). */
  maxWidth?: number;
  /** Cap popover height (default 320px). */
  maxHeight?: number;
}

interface DecoderEntry {
  name: string;
  matches: XdrKind;
  decode: (v: string, fmt: "base64") => unknown;
}

const DECODERS: DecoderEntry[] = [
  {
    name: "TransactionEnvelope",
    matches: "envelope",
    decode: (v, fmt) => xdr.TransactionEnvelope.fromXDR(v, fmt),
  },
  {
    name: "TransactionResult",
    matches: "result",
    decode: (v, fmt) => xdr.TransactionResult.fromXDR(v, fmt),
  },
  {
    name: "TransactionMeta",
    matches: "meta",
    decode: (v, fmt) => xdr.TransactionMeta.fromXDR(v, fmt),
  },
  {
    name: "ScVal",
    matches: "scval",
    decode: (v, fmt) => xdr.ScVal.fromXDR(v, fmt),
  },
  {
    name: "LedgerEntry",
    matches: "ledgerEntry",
    decode: (v, fmt) => xdr.LedgerEntry.fromXDR(v, fmt),
  },
  {
    name: "SorobanAuthorizationEntry",
    matches: "sorobanAuth",
    decode: (v, fmt) => xdr.SorobanAuthorizationEntry.fromXDR(v, fmt),
  },
];

function bigIntReplacer(_: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

type DecodeResult =
  | { ok: true; json: string; type: string }
  | { ok: false; error: string };

function safeDecode(value: string, kind: XdrKind): DecodeResult {
  const candidates =
    kind === "auto"
      ? DECODERS
      : DECODERS.filter((d) => d.matches === kind);

  if (candidates.length === 0) {
    return { ok: false, error: `Unknown XDR kind: ${kind}` };
  }

  let lastErr = "";
  for (const entry of candidates) {
    try {
      const decoded = entry.decode(value, "base64");
      return {
        ok: true,
        json: JSON.stringify(decoded, bigIntReplacer, 2),
        type: entry.name,
      };
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    ok: false,
    error: lastErr
      ? `Could not decode XDR as ${candidates.map((d) => d.name).join(" or ")}: ${lastErr}`
      : "Could not decode XDR.",
  };
}

export function XdrTooltip({
  value,
  kind = "auto",
  children,
  className,
  maxWidth = 480,
  maxHeight = 320,
}: XdrTooltipProps) {
  const [open, setOpen] = useState(false);

  // Hooks must run unconditionally on every render. We compute the trigger
  // element eagerly (always-cloneElement / always-wrap-in-span) and short-
  // circuit at render time when there's no XDR to decode.

  // Build the trigger that will be forwarded to Radix's TooltipTrigger.
  // Avoid hard-coded wrappers so consumers can pass block-level children
  // (e.g. the `<pre>` blocks in transaction-result.tsx) without producing
  // invalid `<span><div>…</div></span>` markup.
  const trigger = useMemo(() => {
    const mergedClass = [
      "cursor-help",
      typeof children === "object" &&
        isValidElement(children) &&
        ((children.props as { className?: string }).className ?? ""),
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const dataProps = { "data-xdr-tooltip": true, tabIndex: 0 };

    if (isValidElement(children)) {
      const childProps = children.props as Record<string, unknown>;
      const baseProps = mergedClass
        ? { className: mergedClass }
        : ({} as Record<string, unknown>);
      const nextProps: Record<string, unknown> = {
        ...baseProps,
        ...dataProps,
      };
      if (childProps.tabIndex === undefined) {
        nextProps.tabIndex = 0;
      }
      return cloneElement(children as ReactElement, nextProps);
    }

    return (
      <span className={mergedClass || "cursor-help"} {...dataProps}>
        {children}
      </span>
    );
  }, [children, className]);

  // Decode only when the tooltip is opened to keep the parent render cheap.
  const result = useMemo<DecodeResult | null>(() => {
    if (!open || !value) return null;
    try {
      return safeDecode(value, kind);
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Decode crashed.",
      };
    }
  }, [open, value, kind]);

  if (!value) {
    return <>{children}</>;
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="border border-zinc-800 bg-zinc-950 p-0 text-xs text-zinc-50"
        style={{ maxWidth, width: maxWidth }}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-400">
          <Braces className="h-3 w-3" />
          <span>XDR Decode</span>
        </div>
        <div
          className="overflow-auto px-3 py-2 font-mono text-[11px] leading-snug"
          style={{ maxHeight }}
        >
          {!open || result === null ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Decoding…</span>
            </div>
          ) : result.ok ? (
            <>
              <div className="mb-2 text-[10px] uppercase tracking-wide text-emerald-400">
                {result.type}
              </div>
              <pre className="whitespace-pre-wrap break-all">{result.json}</pre>
            </>
          ) : (
            <div className="flex items-start gap-2 text-red-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
