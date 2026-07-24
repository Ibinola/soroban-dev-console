"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCopy, AlertTriangle, Hash } from "lucide-react";
import { toast } from "sonner";

import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

export interface XdrTooltipProps {
  /** Raw base64 XDR string. The component never decodes on its own. */
  value: string;
  /** Optional pre-decoded payload. Recommended for richer UI feedback. */
  decoded?: { typeName: string; json: string } | null;
  /** Inline trigger element. Defaults to a truncated code preview. */
  children?: React.ReactNode;
  /** Side to render the popover (Radix defaults to "top") */
  side?: "top" | "right" | "bottom" | "left";
  /** Optional className for the popover content */
  contentClassName?: string;
  /** Optional className for the trigger wrapper */
  triggerClassName?: string;
  /** Accessible label */
  label?: string;
}

/**
 * <XdrTooltip value={xdrString} decoded={decoded} />
 *
 * FE-680: Hover- or focus-triggered popover that surfaces a decoded
 * representation of an opaque Stellar/Soroban XDR string. Falls back to
 * showing the raw string plus an error indicator when no decoded payload
 * is supplied.
 *
 * Built on Radix Popover so it is keyboard accessible by default (real
 * <button> + Enter/Space activation). Copy-to-clipboard buttons live
 * inside the popover content (interactive content rules out a plain
 * Tooltip).
 */
export function XdrTooltip({
  value,
  decoded,
  children,
  side = "top",
  contentClassName,
  triggerClassName,
  label = "XDR value",
}: XdrTooltipProps) {
  const hasDecoded = React.useMemo(
    () => Boolean(decoded && decoded.json),
    [decoded],
  );

  const copyRaw = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(
        () => toast.success("Raw XDR copied to clipboard"),
        () => toast.error("Could not copy"),
      );
    }
  };
  const copyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (decoded && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(decoded.json).then(
        () => toast.success("Decoded JSON copied to clipboard"),
        () => toast.error("Could not copy"),
      );
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} — press to decode`}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded border border-transparent bg-transparent p-0 transition-colors hover:border-primary/40 focus:border-primary/60 focus:outline-none",
            triggerClassName,
          )}
        >
          {children ?? (
            <code className="break-all font-mono text-[10px]">
              {value.slice(0, 12)}…
            </code>
          )}
          {hasDecoded ? (
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green-500" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className={cn("w-[420px]", contentClassName)}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <Hash className="h-3 w-3" />
              {hasDecoded ? decoded!.typeName : "Unrecognised XDR"}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyRaw}
              title="Copy raw XDR"
              aria-label="Copy raw XDR to clipboard"
            >
              <ClipboardCopy className="h-3 w-3" />
            </Button>
          </div>

          {hasDecoded ? (
            <>
              <pre className="max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 font-mono text-[10px] leading-snug text-zinc-50">
                {decoded!.json}
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={copyJson}
                className="w-full"
              >
                <ClipboardCopy className="mr-1 h-3 w-3" /> Copy decoded JSON
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-[11px] text-yellow-700">
                Could not decode this base64 string as a known Stellar/Soroban
                XDR envelope type. The raw string is shown below.
              </div>
              <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-[10px]">
                {value}
              </pre>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
