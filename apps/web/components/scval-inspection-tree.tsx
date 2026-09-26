"use client";

/**
 * Issue #1109: render a decoded ScVal as an inspection tree where every node
 * carries a colour-coded Soroban type badge (the tooltip shows the underlying
 * XDR enum integer).
 */

import { Badge } from "@devconsole/ui";
import {
  childScvalWrappers,
  humanizeScvalType,
  scvalBadgeClasses,
  scvalBadgeTitle,
  scvalWrapperKey,
} from "@/lib/scval-type-badges";

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ScvalInspectionTree({ value, label }: { value: unknown; label?: string }) {
  const wrapperKey = scvalWrapperKey(value);

  // Leaves (numbers, strings, bools) and anything that is not an ScVal wrapper.
  if (!wrapperKey) {
    return (
      <span className="font-mono text-xs break-all text-zinc-300">
        {label ? <span className="mr-1 text-[10px] uppercase text-muted-foreground">{label}</span> : null}
        {formatScalar(value)}
      </span>
    );
  }

  const wrapperValue = (value as Record<string, unknown>)[wrapperKey];
  const children = childScvalWrappers(wrapperKey, wrapperValue);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {label ? (
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{label}</span>
        ) : null}
        <Badge
          variant="outline"
          className={scvalBadgeClasses(wrapperKey)}
          title={scvalBadgeTitle(wrapperKey)}
          data-testid={`scval-badge-${wrapperKey}`}
        >
          ScValType: {humanizeScvalType(wrapperKey)}
        </Badge>
        {children.length === 0 ? (
          <span className="font-mono text-xs break-all text-zinc-300">{formatScalar(wrapperValue)}</span>
        ) : null}
      </div>

      {children.length > 0 ? (
        <ul className="ml-3 space-y-1 border-l border-white/10 pl-3">
          {children.map((child, index) => (
            <li key={`${wrapperKey}-${index}`}>
              <ScvalInspectionTree
                value={child}
                label={wrapperKey === "map" ? (index % 2 === 0 ? "key" : "val") : `[${index}]`}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
